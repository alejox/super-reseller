import type { ModuleDb } from "@/shared/db/module-db";
import { tickets, ticketMessages } from "./support.schema";
import { users } from "../../identity/infrastructure/identity.schema";
import { eq, desc } from "drizzle-orm";

export class DrizzleSupportRepository {
  constructor(private readonly db: ModuleDb) {}

  async listTickets() {
    const rows = await this.db
      .select({
        id: tickets.id,
        subject: tickets.subject,
        status: tickets.status,
        priority: tickets.priority,
        createdAt: tickets.createdAt,
        updatedAt: tickets.updatedAt,
        userName: users.email,
      })
      .from(tickets)
      .leftJoin(users, eq(tickets.userId, users.id))
      .orderBy(desc(tickets.createdAt));

    return rows;
  }
  
  async getTicketWithMessages(ticketId: string) {
    const rows = await this.db
      .select()
      .from(tickets)
      .where(eq(tickets.id, ticketId))
      .limit(1);
    
    const ticketRow = rows[0];
    
    if (!ticketRow) return null;
    
    const messages = await this.db
      .select({
        id: ticketMessages.id,
        content: ticketMessages.content,
        isInternal: ticketMessages.isInternal,
        createdAt: ticketMessages.createdAt,
        userName: users.email,
        userId: users.id,
      })
      .from(ticketMessages)
      .leftJoin(users, eq(ticketMessages.userId, users.id))
      .where(eq(ticketMessages.ticketId, ticketId))
      .orderBy(ticketMessages.createdAt);

    return { ticket: ticketRow, messages };
  }

  async createTicket(data: { userId: string, subject: string, priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT', initialMessage: string }) {
    return await this.db.transaction(async (tx: any) => {
      const [ticket] = await tx.insert(tickets).values({
        userId: data.userId,
        subject: data.subject,
        priority: data.priority || 'NORMAL',
        status: 'OPEN',
      }).returning();

      await tx.insert(ticketMessages).values({
        ticketId: ticket.id,
        userId: data.userId,
        content: data.initialMessage,
        isInternal: false,
      });

      return ticket;
    });
  }

  async updateTicketStatus(ticketId: string, status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED') {
    await this.db.update(tickets)
      .set({ status, updatedAt: new Date() })
      .where(eq(tickets.id, ticketId));
  }

  async addMessage(data: { ticketId: string, userId: string, content: string, isInternal: boolean }) {
    await this.db.insert(ticketMessages).values({
      ticketId: data.ticketId,
      userId: data.userId,
      content: data.content,
      isInternal: data.isInternal,
    });
    
    await this.db.update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, data.ticketId));
  }
}
