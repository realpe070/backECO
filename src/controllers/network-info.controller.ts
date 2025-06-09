import { Controller, Get, Logger, Req } from '@nestjs/common';
import { Request } from 'express';

function getNetworkInfo() {
    const interfaces = require('os').networkInterfaces();
    let localIP = 'localhost';
    let wifiIP = '';

    for (const [name, nets] of Object.entries(interfaces)) {
        if (Array.isArray(nets)) { // Asegúrate de que 'nets' es un array
            for (const net of nets) {
                if (!net.internal && net.family === 'IPv4') {
                    if (name.toLowerCase().includes('wi-fi')) {
                        wifiIP = net.address;
                    }
                    if (!localIP || localIP === 'localhost') {
                        localIP = net.address;
                    }
                }
            }
        }
    }

    return wifiIP || localIP;
}

@Controller()
export class NetworkInfoController {
    private readonly logger = new Logger(NetworkInfoController.name);

    @Get('network-info')
    getNetworkInfo(@Req() request: Request) {
        try {
            const networkIP = request.headers.host?.split(':')[0] || 'localhost';
            const port = process.env.PORT || 4300;

            this.logger.debug(`📡 Network info requested from ${request.ip} - Returning IP: ${networkIP}`);

            return {
                ip: networkIP,
                port,
                timestamp: new Date().toISOString(),
                webAccessible: true,
                clientIP: request.ip
            };
        } catch (error: any) {
            this.logger.error(`❌ Error getting network info: ${error.message}`);
            return {
                ip: 'localhost',
                port: 4300,
                timestamp: new Date().toISOString(),
                webAccessible: false,
                error: 'Could not determine network info'
            };
        }
    }
}
