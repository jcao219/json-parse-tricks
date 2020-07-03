export function randomString() {
    // flawed but will work ok
    return Math.random().toString(36).substr(2) +
           Math.random().toString(36).substr(2);
}

export function randomJSON(ceil: number = 10, singleBranch: boolean): any {
    if (ceil <= 0) return {};
    const result = {} as any;
    for (let i = 0; i < ceil; i++) {
        result[randomString()] = randomJSON(ceil - 1, !singleBranch);
        if (singleBranch) break;
    }
    return result;
}

const preamble = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "http://example.com/product.schema.json",
  title: "Product",
  description: "A product in the catalog",
};

export function JSONtoSchema(json: any) {
    const genObjectSchema = (json: any) => {
        if (!json) { throw new Error('falsey json'); }
        if (typeof json !== 'object') { throw new Error('only objects supported'); }

        const result = { type: 'object', properties: {} as any };
        for (const [key, value] of Object.entries(json)) {
            result.properties[key] = JSONtoSchema(value);
        }
        return result;
    }
    return { ...preamble, ...genObjectSchema(json) };
}