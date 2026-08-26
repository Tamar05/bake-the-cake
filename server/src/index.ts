import 'dotenv/config';
import { createApp } from './app';
import { createSupabaseStore } from './requestsStore';
import { createSupabaseProfilesStore } from './profilesStore';
import { createMyMemoryTranslator } from './translator';
import { createSupabaseAuthenticator } from './auth';
import { createResendNotifier } from './emailer';

const port = Number(process.env.PORT ?? 3001);
const store = createSupabaseStore();
const translator = createMyMemoryTranslator();
const app = createApp(
  store,
  translator,
  createSupabaseAuthenticator(),
  createSupabaseProfilesStore(),
  createResendNotifier(),
);

app.listen(port, () => {
  console.log(`Bake the Cake server listening on http://localhost:${port}`);
});
