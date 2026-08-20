import 'dotenv/config';
import { createApp } from './app';
import { createSupabaseStore } from './requestsStore';

const port = Number(process.env.PORT ?? 3001);
const store = createSupabaseStore();
const app = createApp(store);

app.listen(port, () => {
  console.log(`Bake the Cake server listening on http://localhost:${port}`);
});
