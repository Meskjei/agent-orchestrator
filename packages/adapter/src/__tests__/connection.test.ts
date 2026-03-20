import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ACPConnectionPool } from '../acp/connection';

describe('ACPConnectionPool', () => {
  let pool: ACPConnectionPool;

  beforeEach(() => {
    pool = new ACPConnectionPool(5000);
  });

  afterEach(async () => {
    await pool.closeAll();
  });

  describe('getConnection', () => {
    it('should create new connection for new config', async () => {
      const connection = await pool.getConnection({
        command: 'echo',
        args: ['test']
      });

      expect(connection).toBeDefined();
      expect(connection.ready).toBe(true);
      expect(connection.process).toBeDefined();
    });

    it('should reuse existing connection for same config', async () => {
      const config = { command: 'node', args: ['-e', 'setTimeout(() => {}, 10000)'] };
      
      const conn1 = await pool.getConnection(config);
      const conn2 = await pool.getConnection(config);

      expect(conn1).toBe(conn2);
    });

    it('should create separate connections for different configs', async () => {
      const conn1 = await pool.getConnection({ command: 'echo', args: ['1'] });
      const conn2 = await pool.getConnection({ command: 'echo', args: ['2'] });

      expect(conn1).not.toBe(conn2);
    });
  });

  describe('close', () => {
    it('should close connection by name', async () => {
      await pool.getConnection({ command: 'node', args: ['-e', 'setTimeout(() => {}, 10000)'] });
      await pool.close('node');

      const conn = await pool.getConnection({ command: 'node', args: ['-e', 'setTimeout(() => {}, 10000)'] });
      expect(conn).toBeDefined();
    });
  });

  describe('closeAll', () => {
    it('should close all connections', async () => {
      await pool.getConnection({ command: 'node', args: ['-e', 'setTimeout(() => {}, 10000)'] });
      await pool.getConnection({ command: 'node', args: ['-e', 'setTimeout(() => {}, 20000)'] });
      
      await pool.closeAll();

      const conn = await pool.getConnection({ command: 'echo' });
      expect(conn).toBeDefined();
    });
  });
});