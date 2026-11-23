CREATE TABLE perfiles (
 user_id TEXT PRIMARY KEY, email TEXT NOT NULL, nombre TEXT NOT NULL,
 tipo TEXT NOT NULL CHECK(tipo IN ('cliente','particular','empresa')),
 empresa TEXT NOT NULL DEFAULT '', creado TEXT NOT NULL, actualizado TEXT NOT NULL
);
