import ajv = require("ajv");
import traverseSchema = require("json-schema-traverse");
import { randomJSON, JSONtoSchema } from "./random-json";
import util = require('util');

export function assertOutputSame(a: any, b: any, log?: boolean): void {
  let output: string;
  if ((output = JSON.stringify(a, undefined, 2)) !== JSON.stringify(b, undefined, 2)) {
    throw new Error("INVALID");
  }
  if (log) {
    console.log(output);
  }
}

function calculateLength(schema: any): number {
  if (schema.type !== 'object') {
    throw new Error('only object schemas supported');
  }
  if (!schema.properties) {
    throw new Error('schema properties missing?')
  }
  // {"p1":v1,"p2":v2}
  let length = 2; // Opening and closing braces
  let delimited = 0;
  for (const [propName, propValue] of Object.entries(schema.properties)) {
    length += 2; // quotes around property name
    length += propName.length; // property name itself
    length += calculateLength(propValue);
    length += 1; // colon separater
    length += 1; // comma delimiter
    delimited = 1;
  }
  return length - delimited; // no trailing delimiter
}

function shortUnitTestLength() {
  const type = 'object';
  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://example.com/product.schema.json",
    title: "Product",
    description: "A product in the catalog",
    type,
    properties: {
      p1: {
        type,
        properties: {},
      },
      p100: {
        type,
        properties: {},
      }
    }
  };
  const json = JSON.stringify({
    p1: {},
    p100: {}
  });
  const actual = calculateLength(schema);
  const expected = json.length;
  if (actual !== expected) {
    throw new Error(`Wrong length: expected ${expected}, actual ${actual}`);
  }
}

function unitTestCalculateLength() {
  const type = 'object';
  const schema = {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "http://example.com/product.schema.json",
    title: "Product",
    description: "A product in the catalog",
    type,
    properties: {
      p1: {
        type,
        properties: {},
      },
      p100: {
        type,
        properties: {
          asdf: {
            type,
            properties: {
              jkl: {
                type,
                properties: {}
              }
            }
          },
          another: {
            type,
            properties: {},
          }
        }
      }
    }
  };
  const json = JSON.stringify({
    p1: {},
    p100: {
      asdf: {
        jkl: {

        }
      },
      another: {},
    }
  });
  if (calculateLength(schema) !== json.length) {
    throw new Error('Wrong length');
  }
}

shortUnitTestLength();

export function schemaJsonParse<T>(schema: {}): any {
  const traverse = (schema: any) => {
    if (schema.type !== 'object') {
      return undefined;
    }
    if (!schema.properties) {
      return undefined;
    }
    let proto = Object.create(null);
    let propName: string, propValue: any;
    let l = 0;
    for (propName in schema.properties) {
      l++;
      propValue = schema.properties[propName];
    }
    // Optimization 0: no properties:
    if (l === 0) {
      proto[propName!] = () => ({});
    }
    // Optimization 1: single property
    if (l === 1) {
      const parseFn = traverse(propValue) ?? JSON.parse;
      const propLength = calculateLength(schema);
      proto[propName!] = (json: any) => parseFn(json.slice(4 + propName.length, propLength - 1));
      return proto;
    }
    // Failed to find any optimizations.
    return JSON.parse;
  };
  // refactor this later
  const proto = traverse(schema);
  if (!proto) {
    console.warn("Unable to optimize!");
    return JSON.parse;
  }
  return (function(proto: any, json: any) {
    const result = {} as any;
    for (const key in proto) {
      result[key] = proto[key](json);
    }
    return result;
  }).bind(null, proto);
}

const makeNewProduct = () => randomJSON(5, true);

console.log("Making product");
const product = makeNewProduct();
console.log("done making product");
console.log(JSON.stringify(product, undefined, 2));
console.log("Generating schema");
const schema = JSONtoSchema(product);
console.log("Done: generating schema");
console.log(JSON.stringify(schema, undefined, 2));

const productString = JSON.stringify(product);
const sliceParse = schemaJsonParse(schema);
const result1 = JSON.parse(productString);
const result2 = sliceParse(productString);
assertOutputSame(result1, result2, true);

const NS_PER_SEC = 1e9;
const MICROS_PER_SEC = 1e6;
async function benchmark() {
  const delay = util.promisify(setTimeout);
  while (true) {
    console.log('---------------------------- BEGIN ITERATION ---------------------------------');
    const product = makeNewProduct();
    const schema = JSONtoSchema(product);
    const maybeFasterParse = schemaJsonParse(schema);

    const productJson = JSON.stringify(product);
    await delay(200);

    const time1 = process.hrtime();
    for (let i = 0; i < 10000; i++) {
      maybeFasterParse(productJson);
    }
    const diff1 = process.hrtime(time1);
    console.log(`                Benchmark took ${diff1[0] * NS_PER_SEC + diff1[1]} nanoseconds`);

    await delay(500);

    const time2 = process.hrtime();
    for (let i = 0; i < 10000; i++) {
      JSON.parse(productJson);
    }
    const diff2 = process.hrtime(time2);

    console.log(`                Benchmark took ${diff2[0] * NS_PER_SEC + diff2[1]} nanoseconds`);
    const change = (diff2[0] - diff1[0]) * MICROS_PER_SEC + Math.round((diff2[1] - diff1[1]) / 1000)
    console.log(`                Difference of latter minus former is ${change} microseconds`);

    await delay(200);
  }
}

benchmark();