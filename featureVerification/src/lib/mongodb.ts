import { MongoClient, MongoClientOptions } from 'mongodb';
import { attachDatabasePool } from '@vercel/functions';

const options: MongoClientOptions = {
  appName: "Drug Trafficking Sentence Predictor",
  maxIdleTimeMS: 5000
};
const client = new MongoClient(process.env.DB_MONGODB_URI ?? "", options);
   
// Attach the client to ensure proper cleanup on function suspension
attachDatabasePool(client);

// Export a module-scoped MongoClient to ensure the client can be shared across functions.
export default client; 