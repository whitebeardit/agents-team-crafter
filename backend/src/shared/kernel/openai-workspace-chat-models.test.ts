import {
  DEFAULT_AGENTS_RUNTIME_MODEL,
  DEFAULT_TEAM_PLANNER_MODEL,
  EOpenAiWorkspaceChatModel,
  pickResolvedWorkspaceChatModel,
} from './openai-workspace-chat-models.js';

describe('pickResolvedWorkspaceChatModel', () => {
  it('uses first preference in chain when unrestricted', () => {
    const m = pickResolvedWorkspaceChatModel({
      preferenceChain: [EOpenAiWorkspaceChatModel.Gpt4oMini, EOpenAiWorkspaceChatModel.Gpt54],
      enabled: undefined,
      productDefault: DEFAULT_AGENTS_RUNTIME_MODEL,
    });
    expect(m).toBe(EOpenAiWorkspaceChatModel.Gpt4oMini);
  });

  it('uses product default when chain empty and unrestricted', () => {
    const m = pickResolvedWorkspaceChatModel({
      preferenceChain: [undefined, undefined],
      enabled: undefined,
      productDefault: DEFAULT_TEAM_PLANNER_MODEL,
    });
    expect(m).toBe(DEFAULT_TEAM_PLANNER_MODEL);
  });

  it('skips preferences not in enabled subset', () => {
    const m = pickResolvedWorkspaceChatModel({
      preferenceChain: [EOpenAiWorkspaceChatModel.Gpt54, EOpenAiWorkspaceChatModel.Gpt41],
      enabled: [EOpenAiWorkspaceChatModel.Gpt41],
      productDefault: DEFAULT_AGENTS_RUNTIME_MODEL,
    });
    expect(m).toBe(EOpenAiWorkspaceChatModel.Gpt41);
  });

  it('falls back to first allowed when default not in subset', () => {
    const m = pickResolvedWorkspaceChatModel({
      preferenceChain: [undefined],
      enabled: [EOpenAiWorkspaceChatModel.Gpt4oMini],
      productDefault: DEFAULT_TEAM_PLANNER_MODEL,
    });
    expect(m).toBe(EOpenAiWorkspaceChatModel.Gpt4oMini);
  });
});
