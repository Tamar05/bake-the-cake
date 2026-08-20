import 'dotenv/config';
import { createApp } from './app';
import { createSupabaseStore } from './requestsStore';
import { createMyMemoryTranslator } from './translator';

const port = Number(process.env.PORT ?? 3001);
const store = createSupabaseStore();
const translator = createMyMemoryTranslator();
const app = createApp(store, translator);

app.listen(port, () => {
  console.log(`Bake the Cake server listening on http://localhost:${port}`);
});
