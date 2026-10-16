import pg from "pg";
import { env } from "../config/env.ts";

export const pool = new pg.Pool({ connectionString: env.databaseUrl, max: 20 });
