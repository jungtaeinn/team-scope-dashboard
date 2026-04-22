'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type AiProvider = 'openai' | 'gemini';

interface AiSettingView {
  provider: AiProvider;
  label: string;
  isConfigured: boolean;
  isEnabled: boolean;
  maskedKey: string | null;
  model: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestMessage: string | null;
}

interface AiSettingsResponse {
  settings: AiSettingView[];
  isEnabled: boolean;
  enabledProviders: AiProvider[];
  enabledLabels: string[];
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error: string | null;
}

interface AiDraft {
  apiKey: string;
  model: string;
  isEnabled: boolean;
}

interface ModelOption {
  value: string;
  label: string;
  hint: string;
}

const MODEL_OPTIONS: Record<AiProvider, ModelOption[]> = {
  openai: [
    {
      value: 'gpt-4o-mini',
      label: 'GPT-4o mini',
      hint: '기본 추천 · 낮은 비용과 빠른 응답',
    },
    {
      value: 'gpt-4.1-mini',
      label: 'GPT-4.1 mini',
      hint: '긴 컨텍스트와 지시 수행이 필요할 때',
    },
  ],
  gemini: [
    {
      value: 'gemini-2.5-flash-lite',
      label: 'Gemini 2.5 Flash-Lite',
      hint: '기본 추천 · 비용 효율과 처리량 중심',
    },
    {
      value: 'gemini-2.0-flash-lite',
      label: 'Gemini 2.0 Flash-Lite',
      hint: '가벼운 작업을 더 저렴하게 처리할 때',
    },
    {
      value: 'gemini-2.5-flash',
      label: 'Gemini 2.5 Flash',
      hint: '속도와 품질 균형이 필요할 때',
    },
  ],
};

const PROVIDER_META: Record<AiProvider, { label: string; description: string; placeholder: string; model: string }> = {
  openai: {
    label: 'ChatGPT',
    description: 'OpenAI용 AI API Key로 TeamScope 프롬프트를 켭니다.',
    placeholder: 'sk-...',
    model: MODEL_OPTIONS.openai[0].value,
  },
  gemini: {
    label: 'Gemini',
    description: 'Google Gemini용 AI API Key로 TeamScope 프롬프트를 켭니다.',
    placeholder: 'AIza...',
    model: MODEL_OPTIONS.gemini[0].value,
  },
};

const PROVIDERS: AiProvider[] = ['openai', 'gemini'];

function createInitialDrafts(): Record<AiProvider, AiDraft> {
  return {
    openai: { apiKey: '', model: PROVIDER_META.openai.model, isEnabled: false },
    gemini: { apiKey: '', model: PROVIDER_META.gemini.model, isEnabled: false },
  };
}

function createInitialProviderMessages(): Record<AiProvider, string | null> {
  return { openai: null, gemini: null };
}

function formatTestedAt(value: string | null) {
  if (!value) return null;

  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

interface ModelSelectProps {
  id: string;
  value: string;
  options: ModelOption[];
  onChange: (value: string) => void;
}

function ModelSelect({ id, value, options, onChange }: ModelSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleSelect = useCallback(
    (nextValue: string) => {
      onChange(nextValue);
      setIsOpen(false);
    },
    [onChange],
  );

  const handleButtonKeyDown = useCallback((event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setIsOpen(true);
    }
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={() => setIsOpen((open) => !open)}
        onKeyDown={handleButtonKeyDown}
        className={cn(
          'flex h-10 w-full items-center justify-between gap-3 rounded-lg border border-gray-300 bg-[var(--background)] px-3 text-left text-sm text-[var(--foreground)] outline-none transition-colors',
          'hover:bg-[var(--accent)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]',
          'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100',
        )}
      >
        <span className="truncate">{selectedOption.label}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform',
            isOpen && 'rotate-180 text-[var(--foreground)]',
          )}
        />
      </button>

      {isOpen ? (
        <div
          id={id}
          role="listbox"
          className={cn(
            'absolute left-0 right-0 top-full z-40 mt-2 max-h-72 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--popover)] p-1.5 text-sm text-[var(--popover-foreground)] shadow-xl',
            'ring-1 ring-black/5 dark:ring-white/10',
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === value;

            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className={cn(
                  'flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                  isSelected
                    ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                    : 'text-[var(--foreground)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]',
                )}
              >
                <Check
                  className={cn('mt-0.5 h-4 w-4 shrink-0 text-[var(--primary)]', isSelected ? 'opacity-100' : 'opacity-0')}
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">{option.label}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]">{option.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export function AIManagementForm() {
  const [settings, setSettings] = useState<Record<AiProvider, AiSettingView | null>>({ openai: null, gemini: null });
  const [drafts, setDrafts] = useState<Record<AiProvider, AiDraft>>(createInitialDrafts);
  const [isLoading, setIsLoading] = useState(true);
  const [savingProvider, setSavingProvider] = useState<AiProvider | null>(null);
  const [testingProvider, setTestingProvider] = useState<AiProvider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<AiProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [providerMessages, setProviderMessages] = useState<Record<AiProvider, string | null>>(createInitialProviderMessages);
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<AiProvider, boolean>>({ openai: false, gemini: false });

  const enabledLabels = useMemo(
    () =>
      PROVIDERS.filter((provider) => settings[provider]?.isConfigured && settings[provider]?.isEnabled)
        .map((provider) => PROVIDER_META[provider].label),
    [settings],
  );

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai-settings');
      const json = (await response.json()) as ApiResponse<AiSettingsResponse>;
      if (!json.success || !json.data) {
        setMessage(json.error ?? 'AI 설정을 불러오지 못했습니다.');
        return;
      }

      const nextSettings: Record<AiProvider, AiSettingView | null> = { openai: null, gemini: null };
      const nextDrafts = createInitialDrafts();

      for (const setting of json.data.settings) {
        nextSettings[setting.provider] = setting;
        nextDrafts[setting.provider] = {
          apiKey: '',
          model: setting.model ?? PROVIDER_META[setting.provider].model,
          isEnabled: setting.isEnabled,
        };
      }

      setSettings(nextSettings);
      setDrafts(nextDrafts);
      setMessage(null);
    } catch (error) {
      console.error('AI 설정 조회 실패:', error);
      setMessage('AI 설정을 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const updateDraft = useCallback((provider: AiProvider, patch: Partial<AiDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [provider]: { ...prev[provider], ...patch },
    }));
  }, []);

  const updateProviderMessage = useCallback((provider: AiProvider, nextMessage: string | null) => {
    setProviderMessages((prev) => ({ ...prev, [provider]: nextMessage }));
  }, []);

  const notifyPromptBar = useCallback(() => {
    window.dispatchEvent(new Event('teamscope:ai-settings-updated'));
  }, []);

  const toggleApiKeyVisibility = useCallback((provider: AiProvider) => {
    setVisibleApiKeys((prev) => ({ ...prev, [provider]: !prev[provider] }));
  }, []);

  const handleSave = useCallback(
    async (provider: AiProvider) => {
      setSavingProvider(provider);
      setMessage(null);
      try {
        const draft = drafts[provider];
        const response = await fetch('/api/ai-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider,
            apiKey: draft.apiKey || undefined,
            model: draft.model,
            isEnabled: draft.isEnabled,
          }),
        });
        const json = (await response.json()) as ApiResponse<AiSettingView>;
        if (!json.success || !json.data) {
          setMessage(json.error ?? 'AI 설정 저장에 실패했습니다.');
          return;
        }

        setSettings((prev) => ({ ...prev, [provider]: json.data }));
        updateDraft(provider, { apiKey: '', model: json.data.model ?? draft.model, isEnabled: json.data.isEnabled });
        setMessage(`${PROVIDER_META[provider].label} 설정을 저장했습니다.`);
        notifyPromptBar();
      } catch (error) {
        console.error('AI 설정 저장 실패:', error);
        setMessage('AI 설정 저장 중 오류가 발생했습니다.');
      } finally {
        setSavingProvider(null);
      }
    },
    [drafts, notifyPromptBar, updateDraft],
  );

  const handleTest = useCallback(
    async (provider: AiProvider) => {
      const draft = drafts[provider];
      const setting = settings[provider];
      const providerLabel = PROVIDER_META[provider].label;

      if (!draft.apiKey && !setting?.isConfigured) {
        const nextMessage = `${providerLabel} AI API Key를 먼저 입력해 주세요.`;
        updateProviderMessage(provider, nextMessage);
        setMessage(nextMessage);
        return;
      }

      setTestingProvider(provider);
      setMessage(null);
      updateProviderMessage(provider, `${providerLabel} 연결을 확인하는 중입니다...`);
      try {
        const response = await fetch('/api/ai-settings/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, apiKey: draft.apiKey || undefined }),
        });
        const json = (await response.json()) as ApiResponse<{
          result: { ok: boolean; message: string };
          setting: AiSettingView;
        }>;

        if (json.data?.setting) {
          setSettings((prev) => ({ ...prev, [provider]: json.data.setting }));
        }

        const nextMessage = json.data?.result.message ?? json.error ?? '연결 테스트에 실패했습니다.';
        updateProviderMessage(provider, nextMessage);
        setMessage(nextMessage);
      } catch (error) {
        console.error('AI 연결 테스트 실패:', error);
        const nextMessage = 'AI 연결 테스트 중 오류가 발생했습니다.';
        updateProviderMessage(provider, nextMessage);
        setMessage(nextMessage);
      } finally {
        setTestingProvider(null);
      }
    },
    [drafts, settings, updateProviderMessage],
  );

  const handleDelete = useCallback(
    async (provider: AiProvider) => {
      const providerLabel = PROVIDER_META[provider].label;
      const confirmed = window.confirm(`${providerLabel} AI API Key와 연결 상태를 제거할까요?`);
      if (!confirmed) return;

      setDeletingProvider(provider);
      setMessage(null);
      updateProviderMessage(provider, null);
      try {
        const response = await fetch('/api/ai-settings', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider }),
        });
        const json = (await response.json()) as ApiResponse<{ provider: AiProvider }>;
        if (!json.success) {
          setMessage(json.error ?? `${providerLabel} 설정 삭제에 실패했습니다.`);
          return;
        }

        setSettings((prev) => ({ ...prev, [provider]: null }));
        updateDraft(provider, { apiKey: '', model: PROVIDER_META[provider].model, isEnabled: false });
        setVisibleApiKeys((prev) => ({ ...prev, [provider]: false }));
        setMessage(`${providerLabel} AI API Key와 연결 상태를 제거했습니다.`);
        notifyPromptBar();
      } catch (error) {
        console.error('AI 설정 삭제 실패:', error);
        setMessage('AI 설정 삭제 중 오류가 발생했습니다.');
      } finally {
        setDeletingProvider(null);
      }
    },
    [notifyPromptBar, updateDraft, updateProviderMessage],
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI 관리</h3>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">
            ChatGPT 또는 Gemini AI API Key를 암호화해 저장하고, 하단 TeamScope 프롬프트를 활성화합니다.
          </p>
        </div>
        <div
          className={cn(
            'inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium',
            enabledLabels.length
              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
              : 'border-[var(--border)] text-[var(--muted-foreground)]',
          )}
        >
          {enabledLabels.length ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {enabledLabels.length ? `${enabledLabels.join(', ')} 연결됨` : 'AI 연결 필요'}
        </div>
      </div>

      {message && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/50 px-3 py-2 text-sm text-[var(--muted-foreground)]">
          {message}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-xl border border-[var(--border)] p-6 text-center text-sm text-[var(--muted-foreground)]">
          AI 설정을 불러오는 중입니다...
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {PROVIDERS.map((provider) => {
            const meta = PROVIDER_META[provider];
            const setting = settings[provider];
            const draft = drafts[provider];
            const isSaving = savingProvider === provider;
            const isTesting = testingProvider === provider;
            const isDeleting = deletingProvider === provider;
            const isApiKeyVisible = visibleApiKeys[provider];
            const providerMessage = providerMessages[provider];
            const testedAt = formatTestedAt(setting?.lastTestedAt ?? null);

            return (
              <section
                key={provider}
                className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--background)] text-[var(--primary)]">
                      {provider === 'openai' ? <Sparkles className="h-5 w-5" /> : <Bot className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-[var(--foreground)]">{meta.label}</h4>
                      <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)] lg:whitespace-nowrap">
                        {meta.description}
                      </p>
                    </div>
                  </div>
                  <label className="inline-flex shrink-0 items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <input
                      type="checkbox"
                      checked={draft.isEnabled}
                      onChange={(event) => updateDraft(provider, { isEnabled: event.target.checked })}
                      className="h-4 w-4 rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                    />
                    사용
                  </label>
                </div>

                <div className="mt-4 space-y-3">
                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[var(--muted-foreground)]">AI API Key</span>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
                      <input
                        type={isApiKeyVisible ? 'text' : 'password'}
                        value={draft.apiKey}
                        onChange={(event) => updateDraft(provider, { apiKey: event.target.value })}
                        placeholder={setting?.isConfigured ? `${setting.maskedKey} 저장됨` : meta.placeholder}
                        className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-11 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => toggleApiKeyVisibility(provider)}
                        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--accent)] hover:text-[var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                        aria-label={isApiKeyVisible ? 'AI API Key 숨기기' : 'AI API Key 보기'}
                        title={isApiKeyVisible ? 'AI API Key 숨기기' : 'AI API Key 보기'}
                      >
                        {isApiKeyVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs font-medium text-[var(--muted-foreground)]">모델</span>
                    <ModelSelect
                      id={`${provider}-model-listbox`}
                      value={draft.model}
                      options={MODEL_OPTIONS[provider]}
                      onChange={(model) => updateDraft(provider, { model })}
                    />
                    <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                      {MODEL_OPTIONS[provider].find((option) => option.value === draft.model)?.hint}
                    </p>
                  </label>

                  <div className="rounded-lg border border-[var(--border)] bg-[var(--background)]/45 px-3 py-2 text-xs text-[var(--muted-foreground)]">
                    {isTesting ? (
                      <div className="flex items-start gap-2 text-[var(--foreground)]">
                        <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-[var(--primary)]" />
                        <span>{providerMessage ?? `${meta.label} 연결을 확인하는 중입니다...`}</span>
                      </div>
                    ) : providerMessage ? (
                      <div className="flex items-start gap-2">
                        {setting?.lastTestStatus === 'success' ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        )}
                        <span>{providerMessage}</span>
                      </div>
                    ) : setting?.lastTestStatus ? (
                      <div className="flex items-start gap-2">
                        {setting.lastTestStatus === 'success' ? (
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                        ) : (
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                        )}
                        <span>
                          {setting.lastTestMessage}
                          {testedAt ? ` · ${testedAt}` : ''}
                        </span>
                      </div>
                    ) : (
                      '저장 전에 연결 테스트로 AI API Key 권한을 확인할 수 있습니다.'
                    )}
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    onClick={() => void handleTest(provider)}
                    disabled={isTesting || isDeleting}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                    연결 테스트
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave(provider)}
                    disabled={isSaving || isDeleting || (draft.isEnabled && !draft.apiKey && !setting?.isConfigured)}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-foreground)] transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(provider)}
                    disabled={isDeleting || isSaving || isTesting || !setting?.isConfigured}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-rose-500/25 px-3 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
                    title={setting?.isConfigured ? `${meta.label} AI API Key 제거` : '저장된 AI API Key가 없습니다'}
                  >
                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    <span className="sr-only sm:not-sr-only">제거</span>
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      )}

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)]/45 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--card)] text-[var(--primary)]">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">Azure AI도 합류 예정입니다</p>
            <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)] lg:whitespace-nowrap">
              이후 Azure OpenAI/Azure AI Foundry 키와 배포 모델도 같은 방식으로 관리할 수 있게 확장할 예정입니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
