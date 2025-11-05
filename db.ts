import { InterviewData } from './types';

const DB_NAME = 'InterviewDB';
const STORE_NAME = 'interviews';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase>;

const getDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('Database error:', request.error);
        reject('Error opening database');
      };

      request.onsuccess = (event) => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const dbInstance = (event.target as IDBOpenDBRequest).result;
        if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
          dbInstance.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
};


export const addInterviewDB = async (interview: InterviewData): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.add(interview);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      console.error('Error adding interview:', request.error);
      reject('Could not add interview to the database.');
    };
  });
};

export const getAllInterviewsDB = async (): Promise<InterviewData[]> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Error fetching interviews:', request.error);
      reject('Could not fetch interviews from the database.');
    };
  });
};

export const clearAllInterviewsDB = async (): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = () => {
      console.error('Error clearing interviews:', request.error);
      reject('Could not clear interviews from the database.');
    };
  });
};

export const replaceInterviewsDB = async (interviews: InterviewData[]): Promise<void> => {
    const db = await getDb();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const clearRequest = store.clear();

        clearRequest.onerror = () => {
            transaction.abort();
            reject('Could not clear interviews from the database.');
        };

        clearRequest.onsuccess = () => {
            if (interviews.length === 0) {
                return;
            }
            interviews.forEach(interview => {
                store.add(interview);
            });
        };

        transaction.oncomplete = () => {
            resolve();
        };

        transaction.onerror = () => {
            reject('Transaction failed while replacing interviews.');
        };
    });
};
