import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
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
        const paths = [
            '/api/startup-context',
            '/api/hardware/products',
            '/api/hardware/categories',
            '/api/hardware/suppliers',
            '/api/hardware/purchase-orders',
            '/api/hardware/inventory/balances',
            '/api/hardware/sales/invoices',
            '/api/hardware/goods-receipts',
            '/api/hardware/supplier-invoices',
            '/api/hardware/supplier-returns',
            '/api/hardware/till/active',
            '/api/hardware/supplier-invoices/reports/rate-differences',
        ];
        const entries = paths.map(path => path.slice(1) + '.ts');
        const apiFiles = readdirSync(join(root, 'api'), { recursive: true, withFileTypes: true })
            .filter(entry => entry.isFile())
            .map(entry => relative(root, join(entry.parentPath, entry.name)).replaceAll('\\', '/'));
        assert.deepEqual(apiFiles.sort(), [...entries].sort(), 'Review every API entry before including it in the pilot');
        for (const entry of entries)
            emit(join(root, entry));
        const entryUrls = entries.map(entry => pathToFileURL(join(output, entry.replace(/\.ts$/, '.js'))).href);
        const script = `
            import assert from 'node:assert/strict';
            let calls=0;
            globalThis.fetch=async()=>{calls++;throw new Error('Network is forbidden in this test');};
            for(const [index,url] of ${JSON.stringify(entryUrls)}.entries()) {
                const {default:handler}=await import(url);
                const route = ${JSON.stringify(paths)}[index];
                const path = route === '/api/startup-context' ? route : route + '?storeId=33333333-3333-4333-8333-333333333333' + (route === '/api/hardware/till/active' ? '' : '&page=1&limit=10');
                if (['/api/hardware/categories', '/api/hardware/products', '/api/hardware/suppliers'].includes(route)) {
                    let body = '';
                    const res = { statusCode: 0, setHeader() {}, end: value => body = value };
                    await handler({method:'POST',url:route,headers:{}},res);
                    assert.equal(res.statusCode,401);
                    assert.equal(JSON.parse(body).code,'SESSION_REQUIRED');
                }
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
