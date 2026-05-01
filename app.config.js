import 'dotenv/config';
import appJson from './app.json';

export default {
  ...appJson.expo,
  extra: {
    nytS: process.env.NYT_S,
    nytA: process.env.NYT_A,
    devDryRun: process.env.DEV_DRY_RUN === 'true',
  },
};
