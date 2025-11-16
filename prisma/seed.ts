import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...')

  // Limpar dados existentes
  console.log('🗑️  Limpando dados existentes...')
  await prisma.lessonProgress.deleteMany()
  await prisma.comment.deleteMany()
  await prisma.enrollment.deleteMany()
  await prisma.lesson.deleteMany()
  await prisma.course.deleteMany()
  await prisma.registration.deleteMany()
  await prisma.municipalityLimit.deleteMany()
  await prisma.event.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.user.deleteMany()

  // Criar usuário admin
  console.log('👤 Criando usuário admin...')
  const adminPassword = await bcrypt.hash('admin123', 10)
  const admin = await prisma.user.create({
    data: {
      name: 'Administrador',
      email: 'admin@linkdecadastro.com',
      password: adminPassword,
      role: 'ADMIN'
    }
  })
  console.log('✅ Admin criado:', admin.email)

  // Criar usuários comuns
  console.log('👥 Criando usuários comuns...')
  const userPassword = await bcrypt.hash('user123', 10)
  const user1 = await prisma.user.create({
    data: {
      name: 'João Silva',
      email: 'joao@example.com',
      password: userPassword,
      role: 'USER'
    }
  })

  const user2 = await prisma.user.create({
    data: {
      name: 'Maria Santos',
      email: 'maria@example.com',
      password: userPassword,
      role: 'USER'
    }
  })
  console.log('✅ Usuários criados')

  // Criar cursos de exemplo
  console.log('📚 Criando cursos...')
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  
  const nextWeek = new Date(now)
  nextWeek.setDate(nextWeek.getDate() + 7)
  
  const nextMonth = new Date(now)
  nextMonth.setMonth(nextMonth.getMonth() + 1)
  
  const lastWeek = new Date(now)
  lastWeek.setDate(lastWeek.getDate() - 7)
  
  const lastMonth = new Date(now)
  lastMonth.setMonth(lastMonth.getMonth() - 1)

  // Curso em destaque - disponível para inscrição
  const course1 = await prisma.course.create({
    data: {
      title: 'Curso Avançado de Carcinicultura',
      description: 'Aprenda técnicas avançadas de cultivo de camarão com especialistas do setor. Inclui práticas em laboratório e campo.',
      bannerUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
      status: 'ACTIVE',
      startDate: nextWeek,
      endDate: nextMonth,
      createdBy: admin.id,
      lessons: {
        create: [
          {
            title: 'Introdução à Carcinicultura',
            description: 'Visão geral do setor',
            order: 1,
            duration: '30 min'
          },
          {
            title: 'Técnicas de Cultivo',
            description: 'Métodos práticos',
            order: 2,
            duration: '45 min'
          }
        ]
      }
    }
  })

  // Curso em andamento
  const course2 = await prisma.course.create({
    data: {
      title: 'Workshop de Gestão de Viveiros',
      description: 'Workshop prático sobre gestão eficiente de viveiros de camarão. Venha aprender com os melhores profissionais do mercado.',
      bannerUrl: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?w=800',
      status: 'ACTIVE',
      startDate: lastWeek,
      endDate: nextWeek,
      createdBy: admin.id,
      lessons: {
        create: [
          {
            title: 'Fundamentos de Gestão',
            description: 'Conceitos básicos',
            order: 1,
            duration: '40 min'
          }
        ]
      }
    }
  })

  // Curso disponível sem data
  const course3 = await prisma.course.create({
    data: {
      title: 'Palestra sobre Alimentação de Camarões',
      description: 'Palestra teórica sobre nutrição e alimentação de camarões. Saiba como otimizar o crescimento e desenvolvimento.',
      bannerUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
      status: 'ACTIVE',
      createdBy: admin.id,
      lessons: {
        create: [
          {
            title: 'Nutrição Básica',
            description: 'Fundamentos da alimentação',
            order: 1,
            duration: '35 min'
          }
        ]
      }
    }
  })

  // Curso encerrado
  const course4 = await prisma.course.create({
    data: {
      title: 'Curso de Técnicas de Reprodução',
      description: 'Aprenda as melhores técnicas de reprodução de camarões em cativeiro.',
      bannerUrl: 'https://images.unsplash.com/photo-1520637836862-4d197d17c93a?w=800',
      status: 'ACTIVE',
      startDate: lastMonth,
      endDate: lastWeek,
      createdBy: admin.id,
      lessons: {
        create: [
          {
            title: 'Reprodução Natural',
            description: 'Processos naturais',
            order: 1,
            duration: '50 min'
          }
        ]
      }
    }
  })

  // Mais cursos
  const course5 = await prisma.course.create({
    data: {
      title: 'Manejo de Qualidade da Água',
      description: 'Técnicas avançadas para monitoramento e controle da qualidade da água em viveiros.',
      bannerUrl: 'https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800',
      status: 'ACTIVE',
      startDate: tomorrow,
      endDate: nextWeek,
      createdBy: admin.id,
      lessons: {
        create: [
          {
            title: 'Parâmetros de Qualidade',
            description: 'O que monitorar',
            order: 1,
            duration: '45 min'
          }
        ]
      }
    }
  })

  const course6 = await prisma.course.create({
    data: {
      title: 'Sustentabilidade na Carcinicultura',
      description: 'Práticas sustentáveis e responsáveis para o cultivo de camarões.',
      bannerUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
      status: 'ACTIVE',
      startDate: nextMonth,
      endDate: null,
      createdBy: admin.id,
      lessons: {
        create: [
          {
            title: 'Impacto Ambiental',
            description: 'Reduzindo impactos',
            order: 1,
            duration: '60 min'
          }
        ]
      }
    }
  })

  console.log('✅ Cursos criados')

  // Criar algumas inscrições
  console.log('📝 Criando inscrições...')
  await prisma.enrollment.create({
    data: {
      userId: user1.id,
      courseId: course1.id,
      progress: 0
    }
  })

  await prisma.enrollment.create({
    data: {
      userId: user2.id,
      courseId: course2.id,
      progress: 50
    }
  })

  console.log('✅ Inscrições criadas')

  console.log('🎉 Seed concluído com sucesso!')
  console.log('\n📋 Credenciais:')
  console.log('   Admin: admin@linkdecadastro.com / admin123')
  console.log('   User:  joao@example.com / user123')
  console.log('   User:  maria@example.com / user123')
}

main()
  .catch((e) => {
    console.error('❌ Erro no seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

