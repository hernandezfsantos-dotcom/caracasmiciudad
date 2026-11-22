CREATE TABLE listings (id TEXT PRIMARY KEY, owner TEXT NOT NULL, seller TEXT NOT NULL, title TEXT NOT NULL, category TEXT NOT NULL, area TEXT NOT NULL, description TEXT NOT NULL, starts TEXT NOT NULL, price INTEGER NOT NULL, capacity INTEGER NOT NULL, photo TEXT NOT NULL, approved INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1);
--> statement-breakpoint
CREATE TABLE bookings (id TEXT PRIMARY KEY, listing TEXT NOT NULL REFERENCES listings(id), buyer TEXT NOT NULL, email TEXT NOT NULL, qty INTEGER NOT NULL, total INTEGER NOT NULL, fee INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'pendiente', created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
--> statement-breakpoint
CREATE INDEX bookings_listing ON bookings(listing,status);
--> statement-breakpoint
CREATE INDEX bookings_buyer ON bookings(buyer);
