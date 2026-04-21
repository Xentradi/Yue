const CLAN_ALIGNMENTS = ['righteous', 'demonic'];
const CLAN_RECRUITMENT_MODES = ['open', 'closed'];

function normalizeText(value) {
  return String(value ?? '').trim();
}

function normalizeClanAlignment(value, fallback = 'righteous') {
  const normalized = normalizeText(value).toLowerCase();
  return CLAN_ALIGNMENTS.includes(normalized) ? normalized : fallback;
}

function normalizeRecruitmentMode(value, fallback = 'closed') {
  const normalized = normalizeText(value).toLowerCase();
  return CLAN_RECRUITMENT_MODES.includes(normalized) ? normalized : fallback;
}

function normalizeNonNegativeInteger(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function buildClanProfile(clan = {}) {
  const recruitmentMode = normalizeRecruitmentMode(clan.recruitmentMode);
  return {
    id: normalizeText(clan.id) || null,
    name: normalizeText(clan.name) || null,
    alignment: normalizeClanAlignment(clan.alignment),
    virtue: Number.isFinite(Number(clan.virtue)) ? Number(clan.virtue) : 0,
    recruitmentMode,
    isOpenRecruitment: recruitmentMode === 'open',
    memberCount: normalizeNonNegativeInteger(clan.memberCount),
    treasury: normalizeNonNegativeInteger(clan.treasury),
  };
}

function buildMembershipSummary(player = {}) {
  const clanId = normalizeText(player.clanId) || null;
  const clanName = normalizeText(player.clanName) || null;

  return {
    clanId,
    clanName,
    hasClanMembership: Boolean(clanId),
    isWanderer: !clanId,
    membershipState: clanId ? 'member' : 'wanderer',
  };
}

function buildClanContext(clan = {}, player = {}) {
  const profile = buildClanProfile(clan);
  const membership = buildMembershipSummary(player);

  return {
    profile,
    membership,
    canAccessClanResources:
      membership.hasClanMembership && membership.clanId === profile.id,
    canAccessPublicResources: true,
  };
}

function canJoinClan(player = {}, clan = {}) {
  const membership = buildMembershipSummary(player);
  const profile = buildClanProfile(clan);

  if (!profile.id) {
    return {
      allowed: false,
      reason: 'Clan profile is required.',
    };
  }

  if (membership.hasClanMembership) {
    return {
      allowed: false,
      reason: 'Player already belongs to a clan.',
    };
  }

  return {
    allowed: true,
    reason: profile.isOpenRecruitment
      ? 'Open recruitment is available.'
      : 'Clan invitation required.',
  };
}

module.exports = {
  CLAN_ALIGNMENTS,
  CLAN_RECRUITMENT_MODES,
  buildClanContext,
  buildClanProfile,
  buildMembershipSummary,
  canJoinClan,
  normalizeClanAlignment,
  normalizeRecruitmentMode,
};
