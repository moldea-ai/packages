import { getCapabilityFactRows, type ICapabilityFact } from '../../../lib/capabilities/index.ts';

// short rows preserve actual execution facts without presenting a custom summary as an API response
export interface IOperationRow {
  label: string;
  entries: string[];
  detail: string;
}

const title = (key: string): string =>
  key.replaceAll(/([a-z])([A-Z])/gu, '$1 $2').replace(/^./u, (letter) => letter.toUpperCase());
const scalar = (fact: ICapabilityFact): string => {
  if (fact === null) return 'None';
  if (typeof fact === 'boolean') return fact ? 'Yes' : 'No';
  if (typeof fact === 'string' || typeof fact === 'number') return String(fact);
  throw new Error('Operation illustration requires a scalar fact.');
};

/**
 * Projects the known executed page, range, selection, and refusal families into concise rows.
 * @throws If the facts cannot support the selected illustration.
 */
export const getOperationRows = (facts: Record<string, ICapabilityFact>): IOperationRow[] => {
  if (Array.isArray(facts.chunks))
    return getCapabilityFactRows(facts.chunks).map((chunk) => {
      if (
        typeof chunk.byteStart !== 'number' ||
        typeof chunk.byteEnd !== 'number' ||
        typeof chunk.content !== 'string' ||
        typeof chunk.isComplete !== 'boolean'
      )
        throw new Error('Content illustration requires actual byte ranges and text.');
      return {
        label: `Bytes ${chunk.byteStart} to ${chunk.byteEnd}`,
        entries: [chunk.content],
        detail: chunk.isComplete === true ? 'Final chunk' : 'Continues at the next byte offset',
      };
    });
  if (Array.isArray(facts.pages))
    return getCapabilityFactRows(facts.pages).map((page, index) => {
      if (typeof page.hasContinuation !== 'boolean')
        throw new Error('Page illustration requires its actual continuation status.');
      const records = getCapabilityFactRows(page.records ?? page.entries ?? []);
      if (records.length === 0) throw new Error('Page illustration requires its returned records.');
      return {
        label: `Page ${index + 1}`,
        entries: records.map((record) => {
          const identity = record.path ?? record.code ?? record.agentId ?? record.evidenceKind;
          if (typeof identity !== 'string')
            throw new Error('Page illustration requires a record identity.');
          const kind = record.evidenceKind ?? record.type ?? record.kind;
          return `${identity}${typeof kind === 'string' ? ` (${kind})` : ''}`;
        }),
        detail: page.hasContinuation === true ? 'More pages follow' : 'Final page',
      };
    });
  return Object.entries(facts).map(([key, fact]) => {
    if (Array.isArray(fact))
      return {
        label: title(key),
        entries: getCapabilityFactRows(fact).map((entry) => {
          if (typeof entry.path !== 'string')
            throw new Error('Selection illustration requires actual paths.');
          return entry.path;
        }),
        detail: `${fact.length} entries`,
      };
    if (fact !== null && typeof fact === 'object') {
      if (
        Array.isArray(fact.bytes) &&
        typeof fact.offset === 'number' &&
        typeof fact.totalBytes === 'number'
      ) {
        const bytes = fact.bytes;
        if (
          !bytes.every(
            (byte): byte is number =>
              typeof byte === 'number' && Number.isInteger(byte) && byte >= 0 && byte <= 255,
          )
        )
          throw new Error('Range illustration requires actual bytes.');
        return {
          label: title(key),
          entries: [
            `Offset ${fact.offset}; ${bytes.length} of ${fact.totalBytes} bytes`,
            bytes.map((byte) => byte.toString(16).padStart(2, '0')).join(' '),
          ],
          detail: 'Returned bytes in hexadecimal',
        };
      }
      return {
        label: title(key),
        entries: Object.entries(fact).map(([name, value]) => `${title(name)}: ${scalar(value)}`),
        detail: '',
      };
    }
    return { label: title(key), entries: [scalar(fact)], detail: '' };
  });
};
