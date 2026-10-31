#!/usr/bin/env python3
"""Jalankan file SQL ke Supabase produksi via Management API.

Pemakaian: python3 supabase-apply.py <file.sql> [<file2.sql> ...]
Baca token & ref dari env SUPABASE_ACCESS_TOKEN / SUPABASE_REF.
Idempoten: semua file migrasi repo dirancang aman dijalankan ulang.
"""
import json, os, sys, urllib.request

TOKEN = os.environ['SUPABASE_ACCESS_TOKEN']
REF = os.environ['SUPABASE_REF']
URL = f'https://api.supabase.com/v1/projects/{REF}/database/query'


def run_sql(sql, label):
    body = json.dumps({'query': sql}).encode()
    req = urllib.request.Request(URL, data=body, method='POST', headers={
        'Authorization': f'Bearer {TOKEN}',
        'Content-Type': 'application/json',
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            out = r.read().decode()
            print(f'OK   {label}: {out[:200] or "(no result rows)"}')
            return None
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f'FAIL {label}: HTTP {e.code}: {err[:400]}')
        return err
    except Exception as e:
        print(f'FAIL {label}: {e}')
        return str(e)


def main():
    files = sys.argv[1:]
    if not files:
        print('pemakaian: python3 supabase-apply.py <file.sql> [...]')
        sys.exit(1)
    failed = False
    for path in files:
        label = os.path.basename(path)
        sql = open(path).read()
        err = run_sql(sql, label)
        if err:
            failed = True
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
