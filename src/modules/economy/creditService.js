const {
  DEFAULT_BUREAU_SCORE,
  ensureCreditProfile,
} = require('../../storage/creditProfiles');

const CREDIT_BANDS = [
  {
    name: 'exceptional',
    min: 800,
    max: 850,
    baseRate: 0.055,
  },
  {
    name: 'very good',
    min: 740,
    max: 799,
    baseRate: 0.075,
  },
  {
    name: 'good',
    min: 670,
    max: 739,
    baseRate: 0.1,
  },
  {
    name: 'fair',
    min: 580,
    max: 669,
    baseRate: 0.14,
  },
  {
    name: 'poor',
    min: 300,
    max: 579,
    baseRate: 0.2,
  },
];

const BANK_ALIGNMENT_MODIFIERS = {
  righteous: {
    maintenanceGraceMultiplier: 0.95,
    delinquencyFeeMultiplier: 0.98,
    foreclosureFeeMultiplier: 0.95,
  },
  neutral: {
    maintenanceGraceMultiplier: 1,
    delinquencyFeeMultiplier: 1,
    foreclosureFeeMultiplier: 1,
  },
  demonic: {
    maintenanceGraceMultiplier: 0.9,
    delinquencyFeeMultiplier: 1.1,
    foreclosureFeeMultiplier: 1.15,
  },
};

const BANK_MODIFIERS = {
  'heavenly-accord': {
    alignment: 'righteous',
    approvalBias: 18,
    rateMultiplier: 1,
    maxBorrowMultiplier: 5,
    collateralRequirement: 0.28,
    lateThresholdMultiplier: 1,
    delinquencyThresholdMultiplier: 1,
    foreclosureWarningThresholdMultiplier: 1,
    foreclosureThresholdMultiplier: 1,
    delinquencyFeeMultiplier: 0.05,
    foreclosureFeeMultiplier: 0.1,
  },
  'nine-abyss': {
    alignment: 'demonic',
    approvalBias: -24,
    rateMultiplier: 1.16,
    maxBorrowMultiplier: 4.6,
    collateralRequirement: 0.34,
    lateThresholdMultiplier: 0.75,
    delinquencyThresholdMultiplier: 0.75,
    foreclosureWarningThresholdMultiplier: 0.75,
    foreclosureThresholdMultiplier: 0.75,
    delinquencyFeeMultiplier: 0.08,
    foreclosureFeeMultiplier: 0.14,
  },
  'golden-abacus': {
    alignment: 'neutral',
    approvalBias: 10,
    rateMultiplier: 0.94,
    maxBorrowMultiplier: 5.4,
    collateralRequirement: 0.24,
    lateThresholdMultiplier: 1.25,
    delinquencyThresholdMultiplier: 1.25,
    foreclosureWarningThresholdMultiplier: 1.25,
    foreclosureThresholdMultiplier: 1.25,
    delinquencyFeeMultiplier: 0.04,
    foreclosureFeeMultiplier: 0.08,
  },
};

function normalizeAmount(amount) {
  const parsed = Number(amount);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function getCreditBand(score) {
  const bureauScore = Math.min(850, Math.max(300, Math.trunc(score)));
  return (
    CREDIT_BANDS.find(
      (band) => bureauScore >= band.min && bureauScore <= band.max,
    ) ?? {
      name: 'distressed',
      min: 0,
      max: 299,
      baseRate: 0.28,
    }
  );
}

function getBankModifier(bankId) {
  return (
    BANK_MODIFIERS[bankId] ?? {
      alignment: 'neutral',
      approvalBias: 0,
      rateMultiplier: 1,
      maxBorrowMultiplier: 5,
      collateralRequirement: 0.3,
      lateThresholdMultiplier: 1,
      delinquencyThresholdMultiplier: 1,
      foreclosureWarningThresholdMultiplier: 1,
      foreclosureThresholdMultiplier: 1,
      delinquencyFeeMultiplier: 0.05,
      foreclosureFeeMultiplier: 0.1,
    }
  );
}

function getBankAlignmentModifier(alignment) {
  return (
    BANK_ALIGNMENT_MODIFIERS[alignment] ?? BANK_ALIGNMENT_MODIFIERS.neutral
  );
}

function getBankPolicy(bankId) {
  const modifier = getBankModifier(bankId);
  const alignmentPolicy = getBankAlignmentModifier(modifier.alignment);

  return {
    ...modifier,
    ...alignmentPolicy,
    lateThresholdMultiplier:
      (modifier.lateThresholdMultiplier ?? 1) *
      alignmentPolicy.maintenanceGraceMultiplier,
    delinquencyThresholdMultiplier:
      (modifier.delinquencyThresholdMultiplier ?? 1) *
      alignmentPolicy.maintenanceGraceMultiplier,
    foreclosureWarningThresholdMultiplier:
      (modifier.foreclosureWarningThresholdMultiplier ?? 1) *
      alignmentPolicy.maintenanceGraceMultiplier,
    foreclosureThresholdMultiplier:
      (modifier.foreclosureThresholdMultiplier ?? 1) *
      alignmentPolicy.maintenanceGraceMultiplier,
    delinquencyFeeMultiplier:
      (modifier.delinquencyFeeMultiplier ?? 0.05) *
      alignmentPolicy.delinquencyFeeMultiplier,
    foreclosureFeeMultiplier:
      (modifier.foreclosureFeeMultiplier ?? 0.1) *
      alignmentPolicy.foreclosureFeeMultiplier,
  };
}

function formatRate(rate) {
  return `${(rate * 100).toFixed(1)}%`;
}

function estimateTermMonths(amount, creditScore, rateMultiplier) {
  const normalizedAmount = Math.max(1, amount);
  const capacity = Math.max(
    1,
    Math.round((creditScore / 10) * (2 / rateMultiplier)),
  );
  return Math.max(1, Math.ceil(normalizedAmount / capacity));
}

function buildLoanQuote(profile, bankId, amount) {
  const normalizedAmount = normalizeAmount(amount);
  const quotedAmount =
    Number.isInteger(normalizedAmount) && normalizedAmount > 0
      ? normalizedAmount
      : 0;
  const creditBand = getCreditBand(profile.bureauScore ?? DEFAULT_BUREAU_SCORE);
  const modifier = getBankModifier(bankId);
  const approvalScore =
    (profile.bureauScore ?? DEFAULT_BUREAU_SCORE) + modifier.approvalBias;
  const maxBorrow = Math.max(
    100,
    Math.round(Math.max(approvalScore, 0) * modifier.maxBorrowMultiplier),
  );
  const approved =
    quotedAmount > 0 && approvalScore >= 300 && quotedAmount <= maxBorrow;
  const interestRate = Math.max(
    0.01,
    creditBand.baseRate * modifier.rateMultiplier,
  );
  const collateralRequirement =
    quotedAmount > 0
      ? Math.max(50, Math.round(quotedAmount * modifier.collateralRequirement))
      : 0;

  return {
    approved,
    reason: approved
      ? 'Approved under current bureau terms.'
      : approvalScore < 300
        ? 'Borrower is below the minimum bureau threshold.'
        : `Requested amount exceeds the current cap of ${maxBorrow.toLocaleString()}.`,
    bankId,
    bureauScore: profile.bureauScore ?? DEFAULT_BUREAU_SCORE,
    creditBand: creditBand.name,
    approvalScore,
    maxBorrow,
    amount: quotedAmount,
    interestRate,
    interestRateLabel: formatRate(interestRate),
    estimatedTermMonths: estimateTermMonths(
      quotedAmount,
      profile.bureauScore ?? DEFAULT_BUREAU_SCORE,
      modifier.rateMultiplier,
    ),
    collateralRequirement,
    collateralLabel: `${collateralRequirement.toLocaleString()} coin-equivalent collateral`,
    bankModifier: modifier,
    bankPolicy: modifier,
  };
}

async function getLoanQuote(userId, bankId, amount, options = {}) {
  const profile = await ensureCreditProfile(userId, options);
  if (!profile) {
    return {
      approved: false,
      reason: 'Unable to load credit profile.',
    };
  }

  return buildLoanQuote(profile, bankId, amount);
}

module.exports = {
  BANK_MODIFIERS,
  BANK_ALIGNMENT_MODIFIERS,
  CREDIT_BANDS,
  buildLoanQuote,
  getBankModifier,
  getBankAlignmentModifier,
  getBankPolicy,
  getCreditBand,
  getLoanQuote,
};
