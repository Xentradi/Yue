# Domain Model Sketch

Status: working draft. This is a planning reference only and is **not** the source of truth yet.

This document captures the current rough shape of the intended long-term domain model for Yue. It is intentionally broader than the current implementation and should be treated as a design sketch until the schema and services are validated.

```json
{
  "DomainModel": {
    "Player": {
      "purpose": "Global Discord account identity",
      "fields": {
        "id": "uuid",
        "discordUserId": "string",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "Character": {
      "purpose": "The cultivator owned by a player; core gameplay identity",
      "fields": {
        "id": "uuid",
        "playerId": "uuid",
        "name": "string",
        "sex": "string|null",
        "age": "number",
        "lifespanMax": "number",
        "backgroundId": "uuid",
        "alignment": "righteous|neutral|demonic",
        "virtue": "number",
        "path": "body|qi|balanced",
        "daoFocus": "string|null",
        "currentTitleId": "uuid|null",
        "currentRegionId": "uuid|null",
        "currentLocationId": "uuid|null",
        "isAlive": "boolean",
        "isSealed": "boolean",
        "isMissing": "boolean",
        "isRetired": "boolean",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterAttributes": {
      "purpose": "Base character stats only",
      "fields": {
        "characterId": "uuid",
        "physique": "number",
        "comprehension": "number",
        "spirit": "number",
        "fortune": "number",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterTalent": {
      "purpose": "Innate cultivation talent and affinities",
      "fields": {
        "characterId": "uuid",
        "rootType": "string",
        "rootQuality": "number",
        "specialConstitution": "string|null",
        "affinityPrimary": "string|null",
        "affinitySecondary": "string|null",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterCultivation": {
      "purpose": "Current cultivation progression state",
      "fields": {
        "characterId": "uuid",
        "realmIndex": "number",
        "stage": "number",
        "stageMax": "number",
        "stageProgress": "number",
        "cultivationBase": "number",
        "cultivationBaseMax": "number",
        "qiCurrent": "number",
        "qiCurrentMax": "number",
        "qiQuality": "number",
        "foundationQuality": "number",
        "lastBreakthroughAt": "timestamp|null",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterStatus": {
      "purpose": "Body, dantian, meridian, and condition state",
      "fields": {
        "characterId": "uuid",
        "hp": "number",
        "hpMax": "number",
        "condition": "stable|strained|injured|recovering|crippled",
        "state": "idle|cultivating|breakthrough|recovering|injured",
        "meridianState": "stable|strained|damaged|blocked",
        "dantianState": "stable|strained|damaged|cracked",
        "mentalState": "calm|focused|shaken|unstable",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterInjuries": {
      "purpose": "Tracked injury records",
      "fields": {
        "id": "uuid",
        "characterId": "uuid",
        "injuryType": "string",
        "severity": "minor|moderate|severe|critical",
        "source": "string|null",
        "expiresAt": "timestamp|null",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterConditionFlags": {
      "purpose": "Temporary named flags like poisoned, cursed, suppressed",
      "fields": {
        "id": "uuid",
        "characterId": "uuid",
        "flag": "string",
        "source": "string|null",
        "expiresAt": "timestamp|null",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterArts": {
      "purpose": "Equipped/selected major arts by slot",
      "fields": {
        "characterId": "uuid",
        "cultivationMethodId": "uuid|null",
        "bodyRefinementArtId": "uuid|null",
        "movementArtId": "uuid|null",
        "martialArtId": "uuid|null",
        "supportArtId": "uuid|null",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterKnownArts": {
      "purpose": "Learned arts and mastery",
      "fields": {
        "id": "uuid",
        "characterId": "uuid",
        "artId": "uuid",
        "masteryLevel": "number",
        "isEquipped": "boolean",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterResources": {
      "purpose": "Character-owned cultivation resources",
      "fields": {
        "characterId": "uuid",
        "spiritStones": "number",
        "contribution": "number",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterInventoryItems": {
      "purpose": "Inventory rows for items/materials/consumables/equipment",
      "fields": {
        "id": "uuid",
        "characterId": "uuid",
        "itemDefinitionId": "uuid",
        "quantity": "number",
        "slotType": "string|null",
        "isEquipped": "boolean",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterEffects": {
      "purpose": "Temporary buffs, debuffs, and cooldown-driven effects",
      "fields": {
        "id": "uuid",
        "characterId": "uuid",
        "effectType": "string",
        "effectData": "jsonb",
        "expiresAt": "timestamp|null",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterCooldowns": {
      "purpose": "Action cooldown tracking",
      "fields": {
        "id": "uuid",
        "characterId": "uuid",
        "cooldownKey": "string",
        "endsAt": "timestamp",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterSocial": {
      "purpose": "Clan/social attachment",
      "fields": {
        "characterId": "uuid",
        "clanId": "uuid|null",
        "clanRole": "string|null",
        "reputation": "number",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterFinance": {
      "purpose": "Character-linked financial summary",
      "fields": {
        "characterId": "uuid",
        "silver": "number",
        "bankedSilver": "number",
        "debt": "number",
        "activeBankId": "uuid|null",
        "createdAt": "timestamp",
        "updatedAt": "timestamp"
      }
    },

    "CharacterTitlesUnlocked": {
      "purpose": "Unlocked title words by character",
      "fields": {
        "id": "uuid",
        "characterId": "uuid",
        "titleWordId": "uuid",
        "createdAt": "timestamp"
      }
    },

    "CharacterAchievements": {
      "purpose": "Unlocked achievements/milestones",
      "fields": {
        "id": "uuid",
        "characterId": "uuid",
        "achievementKey": "string",
        "unlockedAt": "timestamp"
      }
    },

    "CharacterTribulationHistory": {
      "purpose": "Tribulation and breakthrough history",
      "fields": {
        "id": "uuid",
        "characterId": "uuid",
        "realmIndex": "number",
        "stage": "number",
        "outcome": "success|failure|partial",
        "details": "jsonb",
        "createdAt": "timestamp"
      }
    },

    "BackgroundDefinitions": {
      "purpose": "Reference table for selectable backgrounds",
      "fields": {
        "id": "uuid",
        "key": "string",
        "name": "string",
        "description": "string",
        "physiqueMod": "number",
        "comprehensionMod": "number",
        "spiritMod": "number",
        "fortuneMod": "number"
      }
    },

    "RealmDefinitions": {
      "purpose": "Reference table for realm metadata",
      "fields": {
        "realmIndex": "number",
        "name": "string",
        "stageMax": "number",
        "baseLifespanBonus": "number",
        "hasTribulation": "boolean"
      }
    },

    "TitleWordDefinitions": {
      "purpose": "Reference table for title building blocks",
      "fields": {
        "id": "uuid",
        "slot": "prefix|core|suffix",
        "key": "string",
        "displayText": "string",
        "rarity": "string"
      }
    },

    "Regions": {
      "purpose": "World map regions",
      "fields": {
        "id": "uuid",
        "key": "string",
        "name": "string",
        "description": "string"
      }
    },

    "Locations": {
      "purpose": "Specific locations inside a region",
      "fields": {
        "id": "uuid",
        "regionId": "uuid",
        "key": "string",
        "name": "string",
        "locationType": "string",
        "description": "string"
      }
    },

    "Banks": {
      "purpose": "Reference table for institutions",
      "fields": {
        "id": "uuid",
        "key": "string",
        "name": "string",
        "alignment": "righteous|neutral|demonic"
      }
    },

    "ArtDefinitions": {
      "purpose": "Reference table for arts/methods/skills",
      "fields": {
        "id": "uuid",
        "key": "string",
        "name": "string",
        "artType": "cultivation|body|movement|martial|support",
        "description": "string"
      }
    },

    "ItemDefinitions": {
      "purpose": "Reference table for items",
      "fields": {
        "id": "uuid",
        "key": "string",
        "name": "string",
        "itemType": "material|consumable|equipment|quest",
        "description": "string"
      }
    }
  }
}
```

## Notes

- Treat this as an early cross-model sketch, not a schema contract.
- Expect the actual implementation to split, rename, or collapse parts of this draft.
- Existing runtime behavior and database schema still define the current source of truth until the roadmap explicitly migrates to this model.
