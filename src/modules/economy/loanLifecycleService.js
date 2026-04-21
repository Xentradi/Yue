const loanContracts = require('../../storage/loanContracts');
const { bumpVersion } = require('../../storage/cache');
const { findPlayer, updatePlayerValues } = require('./playerService');
const { withTransaction } = require('../../storage/postgres');
const { getMaintenanceAction } = require('./loanDecisionService');

function normalizeContractDefaults(contract = {}) {
  return {
    userId: contract.userId,
    guildId: contract.guildId,
    bankId: contract.bankId,
    principal: contract.principal ?? contract.currentBalance ?? 0,
    currentBalance: contract.currentBalance ?? contract.principal ?? 0,
    interestRate: contract.interestRate ?? 0,
    estimatedTermMonths: contract.estimatedTermMonths ?? 0,
    bureauScore: contract.bureauScore ?? 0,
    approvalScore: contract.approvalScore ?? 0,
    creditBand: contract.creditBand ?? 'legacy',
    collateralRequirement: contract.collateralRequirement ?? 0,
    state: contract.state ?? loanContracts.LOAN_STATES.ACTIVE,
    metadata: contract.metadata ?? {},
  };
}

async function getOpenLoanContract(userId, guildId, options = {}) {
  return await loanContracts.getOpenLoanContract(userId, guildId, options);
}

async function getLoanDebtSnapshot(userId, guildId, options = {}) {
  const [player, openContract] = await Promise.all([
    findPlayer(userId, guildId, options),
    getOpenLoanContract(userId, guildId, options),
  ]);

  const compatibilityDebt = player?.debt ?? 0;
  const outstandingBalance = openContract?.currentBalance ?? compatibilityDebt;

  return {
    player,
    openContract,
    compatibilityDebt,
    outstandingBalance,
    source: openContract ? 'contract' : 'compatibility',
  };
}

async function createLoanContract(contract, options = {}) {
  return await loanContracts.createLoanContract(
    normalizeContractDefaults(contract),
    options,
  );
}

async function ensureOpenLoanContract(contract, options = {}) {
  const openContract = await getOpenLoanContract(
    contract.userId,
    contract.guildId,
    options,
  );

  if (openContract) {
    return openContract;
  }

  return await createLoanContract(contract, options);
}

async function recordLoanActivation(contract, options = {}) {
  return await createLoanContract(
    {
      ...normalizeContractDefaults(contract),
      state: loanContracts.LOAN_STATES.ACTIVE,
    },
    options,
  );
}

async function recordLoanRepayment(contract, repaymentAmount, options = {}) {
  if (!contract?.userId || !contract?.guildId) {
    return {
      success: false,
      message: 'Loan contract could not be loaded.',
    };
  }

  let activeContract = await getOpenLoanContract(
    contract.userId,
    contract.guildId,
    options,
  );

  if (!activeContract) {
    activeContract = await ensureOpenLoanContract(contract, options);
  }

  if (!activeContract) {
    return {
      success: false,
      message: 'Loan contract could not be loaded.',
    };
  }

  const currentBalance = Math.max(0, activeContract.currentBalance ?? 0);
  const payment = Math.max(0, Math.trunc(repaymentAmount));
  const remainingBalance = Math.max(0, currentBalance - payment);
  const updatedContract = await loanContracts.updateLoanContractBalance(
    activeContract.id,
    remainingBalance,
    options,
  );

  return {
    success: Boolean(updatedContract),
    loanContract: updatedContract,
    remainingBalance,
    closed: remainingBalance === 0,
  };
}

async function transitionLoanState(contractId, state, options = {}) {
  return await loanContracts.updateLoanContractState(
    contractId,
    state,
    options,
  );
}

async function applyMaintenanceTransition(client, contract, action, policy) {
  if (!contract) {
    return null;
  }

  const player = await findPlayer(contract.userId, contract.guildId, {
    client,
    lock: true,
  });

  if (!player) {
    return {
      success: false,
      message: `Missing player record for loan contract ${contract.id}.`,
    };
  }

  if (action === 'late') {
    const updatedContract = await loanContracts.updateLoanContractState(
      contract.id,
      loanContracts.LOAN_STATES.LATE,
      { client },
    );

    return {
      success: Boolean(updatedContract),
      loanContract: updatedContract,
      loanState: updatedContract?.state ?? contract.state,
      feeApplied: 0,
    };
  }

  if (action === 'delinquent' || action === 'foreclosure_warning') {
    const feeMultiplier =
      action === 'delinquent'
        ? (policy?.delinquencyFeeMultiplier ?? 0.05)
        : (policy?.foreclosureFeeMultiplier ?? 0.1);
    const fee = Math.max(
      1,
      Math.round((contract.currentBalance ?? 0) * feeMultiplier),
    );
    const debtResult = await updatePlayerValues(
      player,
      {
        debt: player.debt + fee,
      },
      { client },
    );

    if (!debtResult.success) {
      throw new Error(debtResult.error);
    }

    const updatedContract = await loanContracts.updateLoanContractStatus(
      contract.id,
      action === 'delinquent'
        ? loanContracts.LOAN_STATES.DELINQUENT
        : loanContracts.LOAN_STATES.FORECLOSURE_WARNING,
      (contract.currentBalance ?? 0) + fee,
      { client },
    );

    return {
      success: Boolean(updatedContract),
      loanContract: updatedContract,
      loanState: updatedContract?.state ?? contract.state,
      feeApplied: fee,
    };
  }

  if (action === 'foreclosed') {
    const debtResult = await updatePlayerValues(
      player,
      {
        debt: 0,
      },
      { client },
    );

    if (!debtResult.success) {
      throw new Error(debtResult.error);
    }

    const updatedContract = await loanContracts.updateLoanContractStatus(
      contract.id,
      loanContracts.LOAN_STATES.FORECLOSED,
      0,
      { client },
    );

    return {
      success: Boolean(updatedContract),
      loanContract: updatedContract,
      loanState: updatedContract?.state ?? contract.state,
      feeApplied: 0,
    };
  }

  if (action === 'close') {
    const updatedContract = await loanContracts.updateLoanContractState(
      contract.id,
      loanContracts.LOAN_STATES.CLOSED,
      { client },
    );

    return {
      success: Boolean(updatedContract),
      loanContract: updatedContract,
      loanState: updatedContract?.state ?? contract.state,
      feeApplied: 0,
    };
  }

  return {
    success: true,
    loanContract: contract,
    loanState: contract.state,
    feeApplied: 0,
  };
}

async function runLoanLifecycleMaintenance(options = {}) {
  const now =
    options.now instanceof Date
      ? options.now
      : new Date(options.now ?? Date.now());
  const touchedGuildIds = new Set();

  const result = await withTransaction(async (client) => {
    const openContracts = await loanContracts.listOpenLoanContracts({ client });
    if (openContracts.length === 0) {
      return {
        success: true,
        updatedCount: 0,
        skippedCount: 0,
        touchedGuildIds: [],
      };
    }

    let updatedCount = 0;
    let skippedCount = 0;

    for (const contract of openContracts) {
      const { action, policy } = getMaintenanceAction(contract, now);
      if (action === 'skip') {
        skippedCount += 1;
        continue;
      }

      const maintenanceResult = await applyMaintenanceTransition(
        client,
        contract,
        action,
        policy,
      );

      if (!maintenanceResult?.success) {
        throw new Error(
          maintenanceResult?.message ??
            `Unable to advance loan contract ${contract.id}.`,
        );
      }

      updatedCount += 1;
      touchedGuildIds.add(contract.guildId);
    }

    return {
      success: true,
      updatedCount,
      skippedCount,
      touchedGuildIds: [...touchedGuildIds],
    };
  });

  if (result.success) {
    await Promise.all([
      bumpVersion('tracked'),
      ...(result.touchedGuildIds ?? []).flatMap((guildId) => [
        bumpVersion('player', guildId),
        bumpVersion('leaderboard', guildId),
      ]),
    ]);
  }

  return result;
}

async function markLoanLate(contractId, options = {}) {
  return await transitionLoanState(
    contractId,
    loanContracts.LOAN_STATES.LATE,
    options,
  );
}

async function markLoanDelinquent(contractId, options = {}) {
  return await transitionLoanState(
    contractId,
    loanContracts.LOAN_STATES.DELINQUENT,
    options,
  );
}

async function issueForeclosureWarning(contractId, options = {}) {
  return await transitionLoanState(
    contractId,
    loanContracts.LOAN_STATES.FORECLOSURE_WARNING,
    options,
  );
}

async function forecloseLoan(contractId, options = {}) {
  return await transitionLoanState(
    contractId,
    loanContracts.LOAN_STATES.FORECLOSED,
    options,
  );
}

async function closeLoan(contractId, options = {}) {
  return await transitionLoanState(
    contractId,
    loanContracts.LOAN_STATES.CLOSED,
    options,
  );
}

module.exports = {
  LOAN_STATES: loanContracts.LOAN_STATES,
  closeLoan,
  createLoanContract,
  ensureOpenLoanContract,
  forecloseLoan,
  getOpenLoanContract,
  getMaintenanceAction,
  getLoanDebtSnapshot,
  runLoanLifecycleMaintenance,
  issueForeclosureWarning,
  markLoanDelinquent,
  markLoanLate,
  recordLoanActivation,
  recordLoanRepayment,
  transitionLoanState,
};
