const { createEmbed } = require('./embedUtils');

function formatCurrency(amount) {
  return `$${Math.trunc(amount).toLocaleString()}`;
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
  const netWorth = cash + bank - debt;

  return [
    { name: '💵 Cash', value: formatCurrency(cash), inline: true },
    { name: '🏦 Bank', value: formatCurrency(bank), inline: true },
    { name: '📉 Debt', value: formatCurrency(debt), inline: true },
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
      text: 'Re-run with confirm set to true to apply this change.',
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
