import { db, contacts as contactsTable, applicationContacts, applications } from "@/db";
import { asc } from "drizzle-orm";
import { ContactsView } from "@/components/contacts/ContactsView";

export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const [contacts, links, apps] = await Promise.all([
    db.select().from(contactsTable).orderBy(asc(contactsTable.name)),
    db.select().from(applicationContacts),
    db.select().from(applications),
  ]);

  const appMap = new Map(apps.map((a) => [a.id, { id: a.id, company: a.company, title: a.title }]));
  const linkedApps = contacts.map((c) => ({
    contact: c,
    apps: links
      .filter((l) => l.contactId === c.id)
      .map((l) => appMap.get(l.applicationId))
      .filter((a): a is NonNullable<typeof a> => !!a),
  }));

  return <ContactsView items={linkedApps} />;
}
