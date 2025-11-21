import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShareService {
  constructor(private readonly prisma: PrismaService) {}

  async getCoursePreviewData(courseIdOrSlug: string) {
    // Tenta buscar por ID primeiro
    let course = await this.prisma.course.findUnique({
      where: { id: courseIdOrSlug },
      select: {
        id: true,
        title: true,
        description: true,
        bannerUrl: true,
        slug: true,
      },
    });

    // Se não encontrou por ID, tenta buscar por slug
    if (!course) {
      course = await this.prisma.course.findUnique({
        where: { slug: courseIdOrSlug },
        select: {
          id: true,
          title: true,
          description: true,
          bannerUrl: true,
          slug: true,
        },
      });
    }

    if (!course) {
      throw new NotFoundException('Curso não encontrado');
    }

    return course;
  }

  async getEventPreviewData(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        description: true,
        bannerUrl: true,
        linkId: true,
      },
    });

    if (!event) {
      throw new NotFoundException('Evento não encontrado');
    }

    return event;
  }

  generateOpenGraphHTML(data: {
    title: string;
    description: string | null;
    bannerUrl: string | null;
    url: string;
    type?: string;
  }) {
    const frontendUrl = process.env.FRONTEND_URL || 'https://linkdecadastro.com.br';
    const siteUrl = frontendUrl.replace(/\/$/, '');
    
    // Normalizar URL da imagem
    let imageUrl = data.bannerUrl;
    if (imageUrl) {
      // Se começa com /uploads/, adicionar URL do backend
      if (imageUrl.startsWith('/uploads/')) {
        const backendUrl = process.env.BACKEND_URL || 'https://backend-linkdecadastro.onrender.com';
        imageUrl = `${backendUrl}${imageUrl}`;
      } else if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
        // Se é relativa, assumir que é do backend
        const backendUrl = process.env.BACKEND_URL || 'https://backend-linkdecadastro.onrender.com';
        imageUrl = `${backendUrl}${imageUrl}`;
      }
    } else {
      // Imagem padrão se não houver banner
      imageUrl = `${siteUrl}/logo.png`;
    }

    const description = data.description 
      ? data.description.replace(/<[^>]*>/g, '').substring(0, 200) // Remove HTML e limita a 200 caracteres
      : `${data.title} - Link de Cadastro`;

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  
  <!-- Primary Meta Tags -->
  <title>${this.escapeHtml(data.title)}</title>
  <meta name="title" content="${this.escapeHtml(data.title)}">
  <meta name="description" content="${this.escapeHtml(description)}">

  <!-- Open Graph / Facebook -->
  <meta property="og:type" content="${data.type || 'website'}">
  <meta property="og:url" content="${data.url}">
  <meta property="og:title" content="${this.escapeHtml(data.title)}">
  <meta property="og:description" content="${this.escapeHtml(description)}">
  <meta property="og:image" content="${imageUrl}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Link de Cadastro">

  <!-- Twitter -->
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${data.url}">
  <meta property="twitter:title" content="${this.escapeHtml(data.title)}">
  <meta property="twitter:description" content="${this.escapeHtml(description)}">
  <meta property="twitter:image" content="${imageUrl}">

  <!-- WhatsApp -->
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:secure_url" content="${imageUrl}">
  
  <!-- Redirect to actual page -->
  <meta http-equiv="refresh" content="0; url=${data.url}">
  <script>
    window.location.href = "${data.url}";
  </script>
</head>
<body>
  <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
    <h1>${this.escapeHtml(data.title)}</h1>
    <p>Redirecionando...</p>
    <p><a href="${data.url}">Clique aqui se não for redirecionado</a></p>
  </div>
</body>
</html>`;
  }

  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }
}

