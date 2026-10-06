import { loadConfig } from '../config';
import { ModelManager } from '../ml/modelLoader';
import { loadTensorflowModel, TensorflowImageClassifier } from '../ml/tensorflowClassifier';
import { logEvent } from '../observability/logger';
import { createApp } from './createApp';

const config = loadConfig();
const models = new ModelManager(() => loadTensorflowModel(config.modelDir));
const classifier = new TensorflowImageClassifier(models);

logEvent('model_load_start', { modelDir: config.modelDir });
await classifier.initialize();
logEvent('model_load_complete', {});

const handle = await createApp({
  config,
  classifier,
  clientMode: config.nodeEnv === 'production' ? 'static' : 'vite',
});

const server = handle.app.listen(config.port, () => {
  logEvent('server_listen', { port: config.port, mode: config.nodeEnv });
});

async function shutdown(): Promise<void> {
  server.close();
  await handle.close();
  await models.dispose();
}

process.on('SIGINT', () => {
  void shutdown().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  void shutdown().finally(() => process.exit(0));
});
