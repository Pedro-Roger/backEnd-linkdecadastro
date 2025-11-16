"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailService = void 0;
const common_1 = require("@nestjs/common");
const nodemailer = __importStar(require("nodemailer"));
let EmailService = class EmailService {
    transporter;
    constructor() {
        this.transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }
    async sendRegistrationEmail(to, name, eventTitle) {
        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@linkdecadastro.com',
            to,
            subject: `Confirmação de Cadastro - ${eventTitle}`,
            html: `
      <h1>Cadastro Confirmado!</h1>
      <p>Olá ${name},</p>
      <p>Seu cadastro no evento <strong>${eventTitle}</strong> foi confirmado com sucesso!</p>
      <p>Aguarde mais informações em breve.</p>
      <hr>
      <p><strong>Quero Cursos</strong></p>
    `,
        };
        return this.transporter.sendMail(mailOptions);
    }
    async sendAdminNotificationEmail(adminEmail, registrationData) {
        const mailOptions = {
            from: process.env.SMTP_FROM || 'noreply@linkdecadastro.com',
            to: adminEmail,
            subject: `Nova Inscrição - ${registrationData.eventTitle}`,
            html: `
      <h1>Nova Inscrição Recebida</h1>
      <p><strong>Nome:</strong> ${registrationData.name}</p>
      <p><strong>Email:</strong> ${registrationData.email}</p>
      <p><strong>CPF:</strong> ${registrationData.cpf}</p>
      <p><strong>Cidade:</strong> ${registrationData.city}</p>
      <p><strong>Evento:</strong> ${registrationData.eventTitle}</p>
    `,
        };
        return this.transporter.sendMail(mailOptions);
    }
};
exports.EmailService = EmailService;
exports.EmailService = EmailService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], EmailService);
//# sourceMappingURL=email.service.js.map