/**
 * Database Seed Script
 * Populates the database with initial data for development
 */

import { PrismaClient, TaskStatus, TaskPriority, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================
  // Create Demo User
  // ============================================
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@productivity-platform.com' },
    update: {},
    create: {
      email: 'demo@productivity-platform.com',
      displayName: 'Demo User',
      timezone: 'America/Mexico_City',
      role: UserRole.USER,
      settings: {
        theme: 'light',
        language: 'es',
        notifications: true,
        emailNotifications: true,
        pushNotifications: true,
      },
    },
  });

  console.log(`✅ Created user: ${demoUser.email}`);

  // ============================================
  // Create Projects
  // ============================================
  const projects = await Promise.all([
    prisma.project.create({
      data: {
        userId: demoUser.id,
        name: 'Personal',
        color: '#3B82F6',
        icon: '🏠',
        isFavorite: true,
        order: 1,
      },
    }),
    prisma.project.create({
      data: {
        userId: demoUser.id,
        name: 'Work',
        color: '#10B981',
        icon: '💼',
        isFavorite: true,
        order: 2,
      },
    }),
    prisma.project.create({
      data: {
        userId: demoUser.id,
        name: 'Learning',
        color: '#F59E0B',
        icon: '📚',
        order: 3,
      },
    }),
    prisma.project.create({
      data: {
        userId: demoUser.id,
        name: 'Health & Fitness',
        color: '#EF4444',
        icon: '💪',
        order: 4,
      },
    }),
  ]);

  console.log(`✅ Created ${projects.length} projects`);

  // ============================================
  // Create Labels
  // ============================================
  const labels = await Promise.all([
    prisma.label.create({
      data: {
        userId: demoUser.id,
        name: 'urgent',
        color: '#EF4444',
      },
    }),
    prisma.label.create({
      data: {
        userId: demoUser.id,
        name: 'waiting',
        color: '#F59E0B',
      },
    }),
    prisma.label.create({
      data: {
        userId: demoUser.id,
        name: 'quick',
        color: '#10B981',
      },
    }),
    prisma.label.create({
      data: {
        userId: demoUser.id,
        name: 'delegation',
        color: '#8B5CF6',
      },
    }),
  ]);

  console.log(`✅ Created ${labels.length} labels`);

  // ============================================
  // Create Tasks with various states
  // ============================================
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const tasks = await Promise.all([
    // Personal tasks
    prisma.task.create({
      data: {
        userId: demoUser.id,
        projectId: projects[0].id,
        title: 'Plan weekend trip',
        description: 'Research destinations and book accommodation',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        dueDate: nextWeek,
        order: 1,
      },
    }),
    prisma.task.create({
      data: {
        userId: demoUser.id,
        projectId: projects[0].id,
        title: 'Pay electricity bill',
        status: TaskStatus.COMPLETED,
        priority: TaskPriority.HIGH,
        dueDate: today,
        completedAt: today,
        order: 2,
      },
    }),
    
    // Work tasks
    prisma.task.create({
      data: {
        userId: demoUser.id,
        projectId: projects[1].id,
        title: 'Prepare Q4 presentation',
        description: 'Create slides for quarterly review meeting',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.HIGH,
        dueDate: tomorrow,
        order: 1,
      },
    }),
    prisma.task.create({
      data: {
        userId: demoUser.id,
        projectId: projects[1].id,
        title: 'Review team pull requests',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        dueDate: today,
        order: 2,
      },
    }),
    prisma.task.create({
      data: {
        userId: demoUser.id,
        projectId: projects[1].id,
        title: 'Update project documentation',
        status: TaskStatus.PENDING,
        priority: TaskPriority.LOW,
        dueDate: nextWeek,
        order: 3,
      },
    }),
    
    // Learning tasks
    prisma.task.create({
      data: {
        userId: demoUser.id,
        projectId: projects[2].id,
        title: 'Complete TypeScript course',
        description: 'Finish advanced types module',
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.MEDIUM,
        dueDate: nextWeek,
        order: 1,
      },
    }),
    prisma.task.create({
      data: {
        userId: demoUser.id,
        projectId: projects[2].id,
        title: 'Read "Clean Architecture"',
        status: TaskStatus.PENDING,
        priority: TaskPriority.LOW,
        order: 2,
      },
    }),
    
    // Health tasks
    prisma.task.create({
      data: {
        userId: demoUser.id,
        projectId: projects[3].id,
        title: 'Morning workout',
        status: TaskStatus.PENDING,
        priority: TaskPriority.HIGH,
        dueDate: today,
        order: 1,
      },
    }),
    prisma.task.create({
      data: {
        userId: demoUser.id,
        projectId: projects[3].id,
        title: 'Schedule dentist appointment',
        status: TaskStatus.PENDING,
        priority: TaskPriority.MEDIUM,
        dueDate: nextWeek,
        order: 2,
      },
    }),
  ]);

  console.log(`✅ Created ${tasks.length} tasks`);

  // ============================================
  // Create Subtasks
  // ============================================
  const subtasks = await Promise.all([
    prisma.subtask.create({
      data: {
        taskId: tasks[2].id, // Q4 presentation
        title: 'Gather metrics from all teams',
        order: 1,
      },
    }),
    prisma.subtask.create({
      data: {
        taskId: tasks[2].id,
        title: 'Design slide templates',
        order: 2,
      },
    }),
    prisma.subtask.create({
      data: {
        taskId: tasks[2].id,
        title: 'Write executive summary',
        order: 3,
      },
    }),
    prisma.subtask.create({
      data: {
        taskId: tasks[5].id, // TypeScript course
        title: 'Watch module videos',
        isCompleted: true,
        order: 1,
      },
    }),
    prisma.subtask.create({
      data: {
        taskId: tasks[5].id,
        title: 'Complete exercises',
        order: 2,
      },
    }),
  ]);

  console.log(`✅ Created ${subtasks.length} subtasks`);

  // ============================================
  // Create Task-Label associations
  // ============================================
  await prisma.taskLabel.createMany({
    data: [
      { taskId: tasks[2].id, labelId: labels[0].id }, // urgent
      { taskId: tasks[3].id, labelId: labels[1].id }, // waiting
      { taskId: tasks[8].id, labelId: labels[2].id }, // quick
    ],
  });

  console.log('✅ Created task-label associations');

  // ============================================
  // Create Reminders
  // ============================================
  const reminderDate = new Date(today);
  reminderDate.setHours(9, 0, 0, 0); // 9 AM

  const reminders = await Promise.all([
    prisma.reminder.create({
      data: {
        taskId: tasks[2].id, // Q4 presentation
        remindAt: reminderDate,
        method: 'BOTH',
      },
    }),
    prisma.reminder.create({
      data: {
        taskId: tasks[8].id, // Morning workout
        remindAt: new Date(today.setHours(6, 0, 0, 0)), // 6 AM
        method: 'PUSH',
      },
    }),
  ]);

  console.log(`✅ Created ${reminders.length} reminders`);

  // ============================================
  // Create Productivity Logs
  // ============================================
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    return date;
  });

  const productivityLogs = await Promise.all(
    last7Days.map((date, index) =>
      prisma.productivityLog.create({
        data: {
          userId: demoUser.id,
          date: new Date(date.setHours(0, 0, 0, 0)),
          tasksCreated: Math.floor(Math.random() * 5) + 1,
          tasksCompleted: Math.floor(Math.random() * 3) + 1,
          focusTime: Math.floor(Math.random() * 120) + 60,
        },
      })
    )
  );

  console.log(`✅ Created ${productivityLogs.length} productivity logs`);

  // ============================================
  // Summary
  // ============================================
  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📊 Summary:');
  console.log(`   Users: 1`);
  console.log(`   Projects: ${projects.length}`);
  console.log(`   Tasks: ${tasks.length}`);
  console.log(`   Subtasks: ${subtasks.length}`);
  console.log(`   Labels: ${labels.length}`);
  console.log(`   Reminders: ${reminders.length}`);
  console.log(`   Productivity Logs: ${productivityLogs.length}`);
  console.log('\n🔐 Demo credentials:');
  console.log(`   Email: demo@productivity-platform.com`);
  console.log(`   (Login with Microsoft OAuth in production)`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
