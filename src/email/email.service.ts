import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: nodemailer.Transporter;

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

  async sendRegistrationEmail(to: string, name: string, eventTitle: string) {
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
      <p><strong>Link de Cadastro</strong></p>
    `,
    };

    return this.transporter.sendMail(mailOptions);
  }

  async sendAdminNotificationEmail(adminEmail: string, registrationData: {
    name: string;
    email: string;
    cpf: string;
    city: string;
    eventTitle: string;
  }) {
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
}


