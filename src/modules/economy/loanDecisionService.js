const loanContracts = require('../../storage/loanContracts');
const { getBankPolicy } = require('./creditService');

const HOURS_BEFORE_LATE = 24;
const HOURS_BEFORE_DELINQUENT = 24;
const HOURS_BEFORE_FORECLOSURE_WARNING = 24;
const HOURS_BEFORE_FORECLOSED = 24;

function getLifecyclePolicy(bankId) {
  const bankPolicy = getBankPolicy(bankId);

  const lateHours = Math.max(
    12,
    Math.round(HOURS_BEFORE_LATE * bankPolicy.lateThresholdMultiplier),
  );
  const delinquentHours =
    lateHours +
    Math.max(
      12,
      Math.round(
        HOURS_BEFORE_DELINQUENT * bankPolicy.delinquencyThresholdMultiplier,
      ),
    );
  const foreclosureWarningHours =
    delinquentHours +
    Math.max(
      12,
      Math.round(
        HOURS_BEFORE_FORECLOSURE_WARNING *
          bankPolicy.foreclosureWarningThresholdMultiplier,
      ),
    );
  const foreclosedHours =
    foreclosureWarningHours +
    Math.max(
      12,
      Math.round(
        HOURS_BEFORE_FORECLOSED * bankPolicy.foreclosureThresholdMultiplier,
      ),
    );

  return {
    ...bankPolicy,
    lateHours,
    delinquentHours,
    foreclosureWarningHours,
    foreclosedHours,
  };
}

function getElapsedHours(referenceTime, now = new Date()) {
  const startedAt = referenceTime ? new Date(referenceTime) : null;
  if (!startedAt || Number.isNaN(startedAt.getTime())) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.max(0, (now.getTime() - startedAt.getTime()) / 36e5);
}

function getMaintenanceAction(contract, now = new Date()) {
  if (!contract) {
    return { action: 'skip' };
  }

  const policy = getLifecyclePolicy(contract.bankId);

  if ((contract.currentBalance ?? 0) <= 0) {
    const action =
      contract.state === loanContracts.LOAN_STATES.CLOSED ? 'skip' : 'close';
    return { action, policy };
  }

  const elapsedHours = getElapsedHours(
    contract.updatedAt ?? contract.createdAt,
    now,
  );

  if (
    contract.state === loanContracts.LOAN_STATES.ACTIVE &&
    elapsedHours >= policy.lateHours
  ) {
    return { action: 'late', policy };
  }

  if (
    contract.state === loanContracts.LOAN_STATES.LATE &&
    elapsedHours >= policy.delinquentHours
  ) {
    return { action: 'delinquent', policy };
  }

  if (
    contract.state === loanContracts.LOAN_STATES.DELINQUENT &&
    elapsedHours >= policy.foreclosureWarningHours
  ) {
    return { action: 'foreclosure_warning', policy };
  }

  if (
    contract.state === loanContracts.LOAN_STATES.FORECLOSURE_WARNING &&
    elapsedHours >= policy.foreclosedHours
  ) {
    return { action: 'foreclosed', policy };
  }

  return { action: 'skip', policy };
}

module.exports = {
  HOURS_BEFORE_DELINQUENT,
  HOURS_BEFORE_FORECLOSED,
  HOURS_BEFORE_FORECLOSURE_WARNING,
  HOURS_BEFORE_LATE,
  getElapsedHours,
  getLifecyclePolicy,
  getMaintenanceAction,
};
