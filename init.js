const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 获取所有可用的网络接口IP地址
function getAllNetworkIPs() {
    const interfaces = os.networkInterfaces();
    const networkIPs = {};

    for (const [name, networkInterface] of Object.entries(interfaces)) {
        for (const net of networkInterface) {
            // 只获取IPv4且非内部地址
            if (net.family === 'IPv4' && !net.internal) {
                networkIPs[name?.toLowerCase()] = net.address
            }
        }
    }
    return networkIPs;
}

// 执行命令并返回结果
function executeCommand(command, options = {}) {
    try {
        const result = execSync(command, {
            encoding: 'utf8',
            stdio: 'pipe',
            ...options
        });
        return result.trim();
    } catch (error) {
        console.error(`命令执行失败: ${command}`);
        console.error(error.message);
        throw error;
    }
}

// 检查mkcert是否存在
function checkMkcert() {
    const mkcertPath = path.join(__dirname, 'mkcert');
    const mkcertExePath = path.join(__dirname, 'mkcert.exe');

    if (fs.existsSync(mkcertPath)) {
        return mkcertPath;
    } else if (fs.existsSync(mkcertExePath)) {
        return mkcertExePath;
    } else {
        throw new Error('mkcert可执行文件不存在，请确保mkcert在当前目录下');
    }
}

async function main() {
    try {
        console.log('🚀 开始设置HTTPS代理服务器...\n');

        // 1. 检查mkcert
        console.log('📋 检查mkcert...');
        const mkcertPath = checkMkcert();
        console.log(`✅ 找到mkcert: ${mkcertPath}\n`);

        // 2. 生成根证书
        console.log('🔐 生成根证书...');
        const caRoot = executeCommand(`"${mkcertPath}" -install`);

        const caRootPath = executeCommand(`"${mkcertPath}" -CAROOT`);
        console.log(`✅ 根证书目录: ${caRootPath}\n`);

        // 3. 获取局域网IP
        console.log('🌐 获取局域网IP...');
        const networkIPs = getAllNetworkIPs();
        const localIP = networkIPs["ethernet"] || networkIPs["wlan"]
        console.log(`✅ 局域网IP: ${localIP}\n`);

        // 4. 生成IP证书
        console.log('📜 生成IP证书...');
        executeCommand(`"${mkcertPath}" ${localIP}`, { cwd: __dirname });

        // 查找生成的证书文件
        const certFile = `${localIP}.pem`;
        const keyFile = `${localIP}-key.pem`;

        if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
            throw new Error('证书文件生成失败');
        }

        console.log(`✅ 证书文件已生成:`);
        console.log(`   - 证书: ${certFile}`);
        console.log(`   - 私钥: ${keyFile}\n`);

        // 5. 写入.env文件
        console.log('📝 写入.env配置...');
        const envContent = `# HTTPS代理服务器配置
LOCAL_IP=${localIP}
CERT_FILE=${certFile}
KEY_FILE=${keyFile}
CA_ROOT=${caRootPath}
`;

        fs.writeFileSync('.env', envContent);
        console.log('✅ .env文件已创建\n');

        // 6. 启动proxy-server.js
        console.log('🚀 启动代理服务器...');

        if (!fs.existsSync('proxy-server.js')) {
            console.warn('⚠️  警告: proxy-server.js文件不存在');
            console.log('请确保proxy-server.js文件在当前目录下');
            return;
        }

        // 使用spawn启动proxy-server.js，这样可以保持进程运行
        const proxyProcess = spawn('node', ['proxy-server.js'], {
            stdio: 'inherit',
            cwd: __dirname
        });

        console.log(`✅ 代理服务器已启动 (PID: ${proxyProcess.pid})`);
        console.log(`🌐 服务器地址: https://${localIP}`);
        console.log('\n按 Ctrl+C 停止服务器\n');

        // 处理进程退出
        process.on('SIGINT', () => {
            console.log('\n🛑 正在停止代理服务器...');
            proxyProcess.kill('SIGINT');
            process.exit(0);
        });

        // 监听子进程退出
        proxyProcess.on('exit', (code) => {
            console.log(`代理服务器已退出 (退出码: ${code})`);
            process.exit(code);
        });

        proxyProcess.on('error', (error) => {
            console.error('启动代理服务器时发生错误:', error);
            process.exit(1);
        });

    } catch (error) {
        console.error('❌ 设置失败:', error.message);
        process.exit(1);
    }
}

// 运行主函数
main();