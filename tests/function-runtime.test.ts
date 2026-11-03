import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
test('unbundled emitted API entries start in plain Node and refuse unauthenticated reads/writes without fetch', () => {
    const root = fileURLToPath(new URL('../', import.meta.url));
    const configFile = ts.readConfigFile(join(root, 'tsconfig.json'), ts.sys.readFile);
    assert.equal(configFile.error, undefined);
    const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
    assert.equal(config.errors.length, 0);
    const output = mkdtempSync(join(tmpdir(), 'hardware-node-functions-'));
    try {
        writeFileSync(join(output, 'package.json'), JSON.stringify({ type: 'module' }));
        const visited = new Set<string>();
        function emit(file: string) {
            if (visited.has(file))
                return;
            visited.add(file);
            const source = readFileSync(file, 'utf8');
            // Trace source imports, but do not bundle or alter emitted import specifiers.
            for (const item of ts.preProcessFile(source).importedFiles) {
                if (!item.fileName.startsWith('.'))
                    continue;
                let dependency = resolve(dirname(file), item.fileName);
                if (!existsSync(dependency))
                    dependency += '.ts';
                emit(dependency);
            }
            const result = ts.transpileModule(source, { fileName: file, compilerOptions: { ...config.options, noEmit: false } });
            const destination = join(output, relative(root, file).replace(/\.ts$/, '.js'));
            mkdirSync(dirname(destination), { recursive: true });
            writeFileSync(destination, result.outputText);
        }
        for (const entry of ['api/startup-context.ts', 'api/hardware/products.ts', 'api/hardware/inventory/balances.ts', 'api/hardware/sales/invoices.ts', 'api/hardware/goods-receipts.ts', 'api/hardware/supplier-invoices.ts', 'api/hardware/supplier-returns.ts', 'api/hardware/supplier-invoices/reports/rate-differences.ts'])
            emit(join(root, entry));
        const entryUrls = ['api/startup-context.js', 'api/hardware/products.js', 'api/hardware/inventory/balances.js', 'api/hardware/sales/invoices.js', 'api/hardware/goods-receipts.js', 'api/hardware/supplier-invoices.js', 'api/hardware/supplier-returns.js', 'api/hardware/supplier-invoices/reports/rate-differences.js'].map(p => pathToFileURL(join(output, p)).href);
        const script = `
            import assert from 'node:assert/strict';
            let calls=0;
            globalThis.fetch=async()=>{calls++;throw new Error('Network is forbidden in this test');};
            for(const [index,url] of ${JSON.stringify(entryUrls)}.entries()) {
                const {default:handler}=await import(url);
                const path=index===0?'/api/startup-context':['','/api/hardware/products','/api/hardware/inventory/balances','/api/hardware/sales/invoices','/api/hardware/goods-receipts','/api/hardware/supplier-invoices','/api/hardware/supplier-returns','/api/hardware/supplier-invoices/reports/rate-differences'][index]+'?storeId=33333333-3333-4333-8333-333333333333&page=1&limit=10';
                for(const method of ['GET','POST','PUT','PATCH','DELETE']) {
                    const headers={};let body='';
                    const res={statusCode:0,setHeader:(k,v)=>headers[k]=v,end:v=>body=v};
                    await handler({method,url:path,headers:{}},res);
                    assert.equal(res.statusCode,method==='GET'?401:405);
                    assert.equal(headers['Cache-Control'],'private, no-store, max-age=0');
                    assert.equal(headers['Vercel-CDN-Cache-Control'],'no-store');
                    assert.equal(JSON.parse(body).code,method==='GET'?'SESSION_REQUIRED':'READ_ONLY_METHOD');
                }
            }
            assert.equal(calls,0);
            process.stdout.write('PASS unbundled Node handlers; zero network calls');
        `;
        const result = execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8', timeout: 15000, stdio: ['ignore', 'pipe', 'pipe'] });
        assert.equal(result, 'PASS unbundled Node handlers; zero network calls');
    }
    finally {
        rmSync(output, { recursive: true, force: true });
    }
});
