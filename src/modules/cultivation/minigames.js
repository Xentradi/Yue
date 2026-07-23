const { selectCultivationMinigame } = require('./flowService');

const GLYPHS = [
  { id: 'azure', label: 'Azure', symbol: 'Azure' },
  { id: 'ember', label: 'Ember', symbol: 'Ember' },
  { id: 'jade', label: 'Jade', symbol: 'Jade' },
  { id: 'void', label: 'Void', symbol: 'Void' },
  { id: 'iron', label: 'Iron', symbol: 'Iron' },
  { id: 'mist', label: 'Mist', symbol: 'Mist' },
];

function buildCultivationChallenge(profile, mode, options = {}) {
  const minigame = selectCultivationMinigame(options);
  const random =
    typeof options.random === 'function' ? options.random : Math.random;

  if (minigame === 'timing') {
    const targetDelayMs = 900 + Math.floor(random() * 1200);
    const zoneWidthMs = 180 + Math.floor(random() * 80);
    const zoneVisual = renderTimingWindow(zoneWidthMs);
    return {
      minigame,
      mode,
      prompt: [
        'Wait for the pulse to reach the bright center window, then press Strike.',
        `Timing window: ${zoneVisual}`,
      ].join('\n'),
      buttons: [
        { id: 'strike', label: 'Strike', style: 'Primary' },
        { id: 'abort', label: 'Abort', style: 'Secondary' },
      ],
      context: {
        targetDelayMs,
        zoneWidthMs,
        zoneVisual,
      },
    };
  }

  if (minigame === 'memory') {
    const memoryQuestionType =
      options.memoryQuestionType ?? (random() < 0.5 ? 'second' : 'notShown');
    const shownGlyphs = shuffleCopy(GLYPHS, random).slice(0, 3);

    if (memoryQuestionType === 'notShown') {
      const notShownGlyph = shuffleCopy(
        GLYPHS.filter(
          (glyph) => !shownGlyphs.some((shown) => shown.id === glyph.id),
        ),
        random,
      )[0];
      const buttons = shuffleCopy([notShownGlyph, ...shownGlyphs], random);

      return {
        minigame,
        mode,
        prompt: `Memorize these three signs: ${shownGlyphs.map((glyph) => glyph.symbol).join(', ')}. Which was NOT shown?`,
        buttons: buttons.map((glyph) => ({
          id: glyph.id,
          label: glyph.label,
          style: 'Primary',
        })),
        context: {
          memoryQuestionType,
          correctChoice: notShownGlyph.id,
          shownGlyphs: shownGlyphs.map((glyph) => glyph.id),
        },
      };
    }

    const correctGlyph = shownGlyphs[1];
    const buttons = shuffleCopy(shownGlyphs, random);
    return {
      minigame,
      mode,
      prompt: [
        `Memorize these three signs: ${shownGlyphs.map((glyph) => glyph.symbol).join(', ')}.`,
        'Which was second?',
      ].join('\n'),
      buttons: buttons.map((glyph) => ({
        id: glyph.id,
        label: glyph.label,
        style: 'Primary',
      })),
      context: {
        memoryQuestionType,
        correctChoice: correctGlyph.id,
        shownGlyphs: shownGlyphs.map((glyph) => glyph.id),
        buttonOrder: buttons.map((glyph) => glyph.id),
      },
    };
  }

  const pushButton = { id: 'push', label: 'Push Through', style: 'Danger' };
  const stabilizeButton = {
    id: 'stabilize',
    label: 'Stabilize',
    style: 'Secondary',
  };

  return {
    minigame: 'risk',
    mode,
    prompt:
      mode === 'aggressive'
        ? 'Aggressive flow: Push Through for bigger gains and more strain, or Stabilize to keep the session under control.'
        : 'Choose Push Through for more Cultivation, or Stabilize for slower but steadier gains.',
    buttons:
      mode === 'aggressive'
        ? [pushButton, stabilizeButton]
        : [stabilizeButton, pushButton],
    context: {
      recommendedChoice: mode === 'aggressive' ? 'push' : 'stabilize',
    },
  };
}

function evaluateCultivationChallenge(challenge, response = {}) {
  const minigame = challenge?.minigame ?? 'risk';
  const mode = challenge?.mode ?? 'steady';
  const selectedChoice = response.choice ?? null;

  if (minigame === 'timing') {
    const targetDelayMs = Number(challenge.context?.targetDelayMs ?? 0);
    const zoneWidthMs = Number(challenge.context?.zoneWidthMs ?? 0);
    const responseTimeMs = Number(response.responseTimeMs ?? 0);
    const delta = Math.abs(responseTimeMs - targetDelayMs);
    const halfZone = Math.max(40, zoneWidthMs / 2);

    let performance = 'poor';
    if (delta <= halfZone * 0.5) {
      performance = 'excellent';
    } else if (delta <= halfZone) {
      performance = 'good';
    } else if (delta <= halfZone * 2.25) {
      performance = 'normal';
    }

    return {
      minigame,
      mode,
      performance,
      detail: 'Strike when the pulse reaches the highlighted center zone.',
      success: performance !== 'poor',
    };
  }

  if (minigame === 'memory') {
    const correctChoice = challenge.context?.correctChoice;
    const success = selectedChoice === correctChoice;
    const questionType = challenge.context?.memoryQuestionType ?? 'second';

    return {
      minigame,
      mode,
      performance: success
        ? questionType === 'notShown'
          ? 'excellent'
          : 'good'
        : 'poor',
      detail:
        questionType === 'notShown'
          ? 'You identified the symbol that never appeared.'
          : 'You recalled the second symbol in the sequence.',
      success,
    };
  }

  const recommendedChoice = challenge.context?.recommendedChoice;
  const choice = selectedChoice === 'push' ? 'push' : 'stabilize';
  const success = choice === recommendedChoice;

  if (choice === 'push') {
    return {
      minigame,
      mode,
      performance: success ? 'excellent' : 'normal',
      detail:
        mode === 'aggressive'
          ? 'You push the flow forward and ride the surge.'
          : 'You force the flow forward for a stronger burst.',
      success: true,
      choice,
    };
  }

  return {
    minigame,
    mode,
    performance: success ? 'good' : 'normal',
    detail:
      mode === 'aggressive'
        ? 'You stabilize the flow and avoid the worst strain.'
        : 'You stabilize the flow for safer gains.',
    success: true,
    choice,
  };
}

function shuffleCopy(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function renderTimingWindow(zoneWidthMs) {
  const width = Math.max(
    3,
    Math.min(9, Math.round(Number(zoneWidthMs ?? 0) / 40)),
  );
  const padding = Math.max(4, 10 - width);
  return `${'░'.repeat(padding)}${'🟩'.repeat(width)}${'░'.repeat(padding)}`;
}

module.exports = {
  buildCultivationChallenge,
  evaluateCultivationChallenge,
  renderTimingWindow,
  shuffleCopy,
};
