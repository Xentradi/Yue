const { createEmbed } = require('./embedUtils');

function toFiniteNumber(amount) {
  return Number.isFinite(amount) ? amount : 0;
}

function formatCurrency(amount) {
  return `$${Math.trunc(toFiniteNumber(amount)).toLocaleString()}`;
}

function formatSignedCurrency(amount) {
  const prefix = amount < 0 ? '-' : '+';
  return `${prefix}${formatCurrency(Math.abs(amount))}`;
}

function getDisplayName(interaction, user) {
  if (interaction?.guild && user?.id) {
    const member = interaction.guild.members.cache.get(user.id);
    if (member) {
      return member.displayName;
    }
  }

  return user?.username ?? 'Unknown user';
}

function createBalanceFields({ cash, bank, debt }) {
  const safeCash = toFiniteNumber(cash);
  const safeBank = toFiniteNumber(bank);
  const safeDebt = toFiniteNumber(debt);
  const netWorth = safeCash + safeBank - safeDebt;

  return [
    { name: '💵 Cash', value: formatCurrency(safeCash), inline: true },
    { name: '🏦 Bank', value: formatCurrency(safeBank), inline: true },
    { name: '📉 Debt', value: formatCurrency(safeDebt), inline: true },
    { name: '🧮 Net Worth', value: formatCurrency(netWorth), inline: true },
  ];
}

function createBalanceEmbed({
  title,
  cash,
  bank,
  debt,
  description,
  color,
  fields = [],
  footer,
}) {
  return createEmbed({
    title,
    description,
    color,
    fields: [...createBalanceFields({ cash, bank, debt }), ...fields],
    footer,
  });
}

function createStatusEmbed({ title, description, color, fields = [], footer }) {
  return createEmbed({
    title,
    description,
    color,
    fields,
    footer,
  });
}

function createConfirmationEmbed({ title, description, fields = [] }) {
  return createEmbed({
    title,
    description,
    color: '#f4a261',
    fields,
    footer: {
      text: 'Click "Yes, apply" to proceed or "No, cancel" to back out.',
    },
  });
}

module.exports = {
  createBalanceEmbed,
  createConfirmationEmbed,
  createStatusEmbed,
  getDisplayName,
  formatCurrency,
  formatSignedCurrency,
};
