import { searchMobileClinics, getMobileClinic } from '../db/resources.js';

export const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'search_mobile_clinics',
      description:
        'Search upcoming mobile clinics in the VillageHub database. ' +
        'Always call this before giving any clinic name, date, time, location, or service.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Optional keywords matched against clinic name, location, notes, and services, e.g. "flu shots" or "dental".',
          },
          limit: { type: 'integer', minimum: 1, maximum: 10 },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_mobile_clinic',
      description: 'Get full details for one mobile clinic by id (from a previous search).',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
        additionalProperties: false,
      },
    },
  },
];

const handlers = {
  search_mobile_clinics: searchMobileClinics,
  get_mobile_clinic: getMobileClinic,
};

export async function runTool(name, rawArgs) {
  const handler = handlers[name];
  if (!handler) return { error: `Unknown tool ${name}` };
  try {
    const args = rawArgs ? JSON.parse(rawArgs) : {};
    const result = await handler(args);
    return { result };
  } catch (err) {
    console.error(`[tool:${name}]`, err.message);
    return { error: err.message };
  }
}
