#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const settingsPath = path.join(root, 'src/store/settingsStore.ts');
const onboardingPath = path.join(root, 'src/screens/OnboardingScreen.tsx');
const navigatorPath = path.join(root, 'src/navigation/AppNavigator.tsx');
const envPath = path.join(root, '.env.local');
const gitignorePath = path.join(root, '.gitignore');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exit(1);
  }
}

const settings = read(settingsPath);
const onboarding = read(onboardingPath);
const navigator = read(navigatorPath);
const envLocal = read(envPath);
const gitignore = read(gitignorePath);
const envLine = envLocal
  .split(/\r?\n/)
  .find((line) => line.startsWith('EXPO_PUBLIC_DEEPSEEK_API_KEY='));
const apiKey = envLine?.split('=')[1]?.trim() ?? '';

assert(apiKey.startsWith('sk-') && apiKey.length > 20, '.env.local should contain a DeepSeek-style API key');
assert(settings.includes("provider: 'deepseek' as const"), 'default service provider should be DeepSeek');
assert(settings.includes("const DEEPSEEK_BASE_URL = 'https://api.deepseek.com/v1'"), 'DeepSeek base URL should be configured');
assert(settings.includes("const DEEPSEEK_DEFAULT_MODEL = 'deepseek-chat'"), 'DeepSeek default model should be configured');
assert(settings.includes('EXPO_PUBLIC_DEEPSEEK_API_KEY'), 'settings should read EXPO_PUBLIC_DEEPSEEK_API_KEY');
assert(settings.includes('applyEnvDeepSeekFallback'), 'saved settings without a key should fall back to env DeepSeek config');
assert(onboarding.includes('configuredApiKey'), 'onboarding should detect an existing configured key');
assert(onboarding.includes('验证本地配置，下一步'), 'onboarding should verify dev config without retyping the key');
assert(onboarding.includes('await testChatCompletion(nextSettings.service)'), 'onboarding should test the service before saving');
assert(navigator.includes('hasConfiguredApiKey'), 'navigator should detect an already saved API key at startup');
assert(navigator.includes("setInitialRoute({ name: 'Main'"), 'navigator should resume to the home screen when a key exists');
assert(!navigator.includes("setInitialRoute({ name: 'Chat'"), 'navigator must not make Chat the root screen');
assert(navigator.includes("AsyncStorage.setItem(ONBOARDING_KEY, 'true')"), 'navigator should backfill onboarding completion when a saved key exists');
assert(gitignore.includes('.env.*'), '.env.* should be ignored by git');

console.log('PASS DeepSeek config is wired. API key is present locally and was not printed.');
