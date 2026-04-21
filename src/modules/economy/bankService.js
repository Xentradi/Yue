const {
  DEFAULT_ACTIVE_BANK,
  ensureBankPreference,
  isValidBankId,
  replaceBankPreference,
} = require('../../storage/bankPreferences');
const depositOperation = require('./bankOperations/deposit');
const withdrawOperation = require('./bankOperations/withdraw');
const takeLoanOperation = require('./loans/takeLoan');
const repayLoanOperation = require('./loans/repayLoan');
const creditService = require('./creditService');

const BANKS = [
  {
    id: 'heavenly-accord',
    name: 'Heavenly Accord Bank',
    aliases: ['heavenly accord', 'accord bank', 'heavenly accord bank'],
  },
  {
    id: 'nine-abyss',
    name: 'Nine Abyss Treasury',
    aliases: ['nine abyss', 'abyss treasury', 'nine abyss treasury'],
  },
  {
    id: 'golden-abacus',
    name: 'Golden Abacus Consortium',
    aliases: ['golden abacus', 'abacus consortium', 'golden abacus consortium'],
  },
];

function normalizeInput(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

function cloneBank(bank) {
  if (!bank) {
    return null;
  }

  return {
    id: bank.id,
    name: bank.name,
    aliases: [...(bank.aliases ?? [])],
  };
}

function listBanks() {
  return BANKS.map((bank) => cloneBank(bank));
}

function findBank(identifier) {
  if (!identifier) {
    return null;
  }

  const normalized = normalizeInput(identifier);
  if (!normalized) {
    return null;
  }

  return (
    BANKS.find((bank) => {
      const candidates = [bank.id, bank.name, ...(bank.aliases ?? [])];
      return candidates.some((candidate) => {
        const normalizedCandidate = normalizeInput(candidate);
        return (
          normalizedCandidate === normalized ||
          normalizedCandidate.includes(normalized) ||
          normalized.includes(normalizedCandidate)
        );
      });
    }) ?? null
  );
}

function getDefaultBank() {
  return cloneBank(findBank(DEFAULT_ACTIVE_BANK));
}

function resolveBank(identifier) {
  return cloneBank(findBank(identifier) ?? getDefaultBank());
}

function searchBanks(query) {
  const normalizedQuery = normalizeInput(query);
  const banks = listBanks();

  if (!normalizedQuery) {
    return banks;
  }

  return banks.filter((bank) => {
    const candidates = [bank.id, bank.name, ...(bank.aliases ?? [])];
    return candidates.some((candidate) =>
      normalizeInput(candidate).includes(normalizedQuery),
    );
  });
}

async function getActiveBank(userId, options = {}) {
  const preference = await ensureBankPreference(
    userId,
    DEFAULT_ACTIVE_BANK,
    options,
  );
  const activeBank = resolveBank(preference?.activeBank);

  return {
    preference,
    activeBank,
  };
}

async function setActiveBank(userId, bankIdentifier, options = {}) {
  const bank = findBank(bankIdentifier);
  if (!bank || !isValidBankId(bank.id)) {
    return {
      success: false,
      message: 'Unknown bank selection.',
    };
  }

  const preference = await replaceBankPreference(userId, bank.id, options);
  if (!preference) {
    return {
      success: false,
      message: 'Unable to save the selected bank.',
    };
  }

  return {
    success: true,
    activeBank: bank,
    preference,
  };
}

async function deposit(userId, guildId, amount, options = {}) {
  const bankState = await getActiveBank(userId, options);
  const result = await depositOperation(userId, guildId, amount, {
    ...options,
    bankId: bankState.activeBank.id,
  });

  return result.success
    ? { ...result, activeBank: bankState.activeBank }
    : result;
}

async function withdraw(userId, guildId, amount, options = {}) {
  const bankState = await getActiveBank(userId, options);
  const result = await withdrawOperation(userId, guildId, amount, {
    ...options,
    bankId: bankState.activeBank.id,
  });

  return result.success
    ? { ...result, activeBank: bankState.activeBank }
    : result;
}

async function takeLoan(userId, guildId, amount, options = {}) {
  const bankState = await getActiveBank(userId, options);
  const quote = await creditService.getLoanQuote(
    userId,
    bankState.activeBank.id,
    amount,
    options,
  );

  if (!quote.approved) {
    return {
      success: false,
      message: quote.reason,
      quote,
      activeBank: bankState.activeBank,
    };
  }

  const result = await takeLoanOperation(userId, guildId, amount, {
    ...options,
    bankId: bankState.activeBank.id,
    loanQuote: quote,
  });

  return result.success
    ? { ...result, activeBank: bankState.activeBank, quote }
    : result;
}

async function repayLoan(userId, guildId, amount, options = {}) {
  const bankState = await getActiveBank(userId, options);
  const result = await repayLoanOperation(userId, guildId, amount, {
    ...options,
    bankId: bankState.activeBank.id,
  });

  return result.success
    ? { ...result, activeBank: bankState.activeBank }
    : result;
}

module.exports = {
  BANKS,
  DEFAULT_ACTIVE_BANK,
  deposit,
  findBank,
  getActiveBank,
  getDefaultBank,
  listBanks,
  repayLoan,
  resolveBank,
  searchBanks,
  setActiveBank,
  takeLoan,
  withdraw,
  getLoanQuote: async (userId, guildId, amount, options = {}) => {
    const bankState = await getActiveBank(userId, options);
    const quote = await creditService.getLoanQuote(
      userId,
      bankState.activeBank.id,
      amount,
      options,
    );

    return {
      success: true,
      ...quote,
      state: 'quoted',
      activeBank: bankState.activeBank,
      bankPolicy: quote.bankPolicy ?? quote.bankModifier ?? null,
    };
  },
};
