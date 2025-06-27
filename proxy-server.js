const https = require('https')
const httpProxy = require('http-proxy')
const fs = require('fs')
const path = require('path');

// 读取.env文件
function loadEnv() {
    const envPath = path.join(__dirname, '.env');
    if (!fs.existsSync(envPath)) {
        throw new Error('.env文件不存在');
    }

    const envContent = fs.readFileSync(envPath, 'utf8');
    const env = {};

    envContent.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
            const [key, value] = line.split('=');
            if (key && value) {
                env[key.trim()] = value.trim();
            }
        }
    });

    return env;
}

async function startServer(httpsPort, httpPort) {
    try {
        // 读取配置文件
        const env = loadEnv();

        // 读取证书文件
        const certPath = path.join(__dirname, env.CERT_FILE);
        const keyPath = path.join(__dirname, env.KEY_FILE);

        if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
            throw new Error('证书文件不存在');
        }

        const options = {
            key: fs.readFileSync(keyPath),
            cert: fs.readFileSync(certPath)
        };

        // 创建代理服务（转发到 http://localhost:3000）
        const proxy = httpProxy.createProxyServer({
            target: `http://localhost:${httpPort}`,
            changeOrigin: true,
        })

        // 启动 HTTPS 服务监听 3443 端口
        https.createServer(options, (req, res) => {
            proxy.web(req, res)
        }).listen(httpsPort, '0.0.0.0', () => {
            console.log(`✅ 请求将转发到 http://localhost:${httpPort}\n`)
            console.log(`✅ HTTPS 代理运行在 https://${env.LOCAL_IP}:${httpsPort}`)
        })
    } catch (error) {
        console.error('❌ 启动服务器失败:', error.message);
    }
}

// https监听的端口
const httpsPort = 3443;
// 转发到哪个http端口
const httpPort = 3000;
// 启动服务器
startServer(httpsPort, httpPort);