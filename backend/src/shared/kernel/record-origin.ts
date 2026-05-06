export type TRecordOriginType = 'agent-coordinator' | 'agent-specialist' | 'user-manual' | 'system';

export type TRecordOrigin = {
  id: string;
  type: TRecordOriginType;
  slug: string;
};

function slugify(value: string): string {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return normalized || 'unknown_origin';
}

function cleanId(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

type TTeamContext = { teamId: string; teamName: string; gallerySubjectSlug?: string };

export function resolveRecordOrigin(params: {
  explicit?: Partial<TRecordOrigin>;
  teamContext?: TTeamContext;
  correlationId?: string;
  fallbackSlug: string;
}): TRecordOrigin {
  const explicitId = cleanId(params.explicit?.id);
  const explicitType = params.explicit?.type;
  const explicitSlug = cleanId(params.explicit?.slug);
  if (explicitId && explicitType && explicitSlug) {
    return { id: explicitId, type: explicitType, slug: slugify(explicitSlug) };
  }

  const teamId = cleanId(params.teamContext?.teamId);
  if (teamId) {
    return {
      id: teamId,
      type: 'agent-coordinator',
      slug: slugify(params.teamContext?.gallerySubjectSlug || params.teamContext?.teamName || params.fallbackSlug),
    };
  }

  const corr = cleanId(params.correlationId);
  return {
    id: corr ?? 'system',
    type: 'system',
    slug: slugify(params.fallbackSlug),
  };
}

