"""DOMUS: servidor local com SQLite, sessões e API de mesma origem."""
import base64, argparse, hashlib, hmac, json, os, re, secrets, sqlite3, time
from datetime import date
from http.cookies import SimpleCookie
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse
ROOT = Path(__file__).resolve().parent
DB = os.environ.get('DOMUS_DB', str(ROOT / 'domus.sqlite3'))
def connect():
    db = sqlite3.connect(DB); db.row_factory = sqlite3.Row
    db.execute('PRAGMA foreign_keys=ON'); return db
def password(value, salt):
    return hashlib.pbkdf2_hmac('sha256', value.encode(), salt.encode(), 260000).hex()
def initialize():
    with connect() as db:
        db.executescript('''
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,role TEXT NOT NULL DEFAULT 'cliente',name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,password TEXT NOT NULL,recovery TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS attempts(ip TEXT,created REAL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER REFERENCES users(id),expires REAL);
CREATE TABLE IF NOT EXISTS properties(id INTEGER PRIMARY KEY,owner INTEGER REFERENCES users(id),title TEXT,city TEXT,neighborhood TEXT,type TEXT,purpose TEXT,price REAL,area REAL,rooms INTEGER,baths INTEGER,parking INTEGER,description TEXT,image TEXT,active INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER REFERENCES users(id),property_id INTEGER REFERENCES properties(id),PRIMARY KEY(user_id,property_id));
CREATE TABLE IF NOT EXISTS visits(id INTEGER PRIMARY KEY,user_id INTEGER REFERENCES users(id),property_id INTEGER REFERENCES properties(id),day TEXT,period TEXT,status TEXT DEFAULT 'Solicitada',UNIQUE(user_id,property_id,day,period));
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,name TEXT,email TEXT,message TEXT,created REAL);
''')
        if 'role' not in [r[1] for r in db.execute('PRAGMA table_info(users)')]: db.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'cliente'")
        if not db.execute('SELECT 1 FROM properties').fetchone():
            items=[('Casa entre jardins','Uberlândia','Jardim Karaíba','Casa','Comprar',890000,210,3,3,2,'Um projeto de linhas simples, ambientes integrados e um jardim para desacelerar.','photo-1600596542815-ffad4c1539a9'),('Luz em cada detalhe','Uberlândia','Santa Mônica','Apartamento','Alugar',2400,84,2,2,1,'Luz natural, varanda e uma planta que acompanha sua rotina.','photo-1600607687920-4e2a09cf159d'),('Arquitetura para viver','Uberlândia','Granja Marileusa','Casa','Comprar',1250000,280,4,4,3,'Espaço para reunir, trabalhar e viver com tranquilidade.','photo-1600047509807-ba8f99d2cdde'),('Seu primeiro endereço','Uberlândia','Centro','Apartamento','Comprar',320000,62,2,1,1,'Uma base prática perto dos serviços e dos encontros da cidade.','photo-1600566753086-00f18fb6b3ea'),('Um novo ritmo','Araguari','Centro','Casa','Alugar',3200,160,3,2,2,'Quintal amplo e espaços flexíveis para uma vida mais leve.','photo-1600607687939-ce8a6c25118c'),('Espaço para criar','Uberlândia','Tibery','Comercial','Alugar',1800,55,0,1,1,'Um espaço versátil para tirar seus próximos projetos do papel.','photo-1497366754035-f200968a6e72')]
            db.executemany('INSERT INTO properties(title,city,neighborhood,type,purpose,price,area,rooms,baths,parking,description,image) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',items)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs): super().__init__(*args,directory=str(ROOT/'web'),**kwargs)
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','DENY')
        self.send_header('Referrer-Policy','same-origin')
        super().end_headers()
    def list_directory(self,path):
        self.send_error(404); return None
    def reply(self,data,status=200,cookie=None):
        raw=json.dumps(data,ensure_ascii=False).encode(); self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8'); self.send_header('Cache-Control','no-store')
        if cookie: self.send_header('Set-Cookie',cookie)
        self.end_headers(); self.wfile.write(raw)
    def user(self,db):
        cookie=SimpleCookie(self.headers.get('Cookie','')); token=cookie.get('domus_session')
        return db.execute('SELECT u.id,u.name,u.email,u.role FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token=? AND s.expires>?',(token.value if token else '',time.time())).fetchone()
    def do_GET(self):
        path=urlparse(self.path).path
        if path.startswith('/api/'):
            with connect() as db:
                user=self.user(db)
                if path=='/api/properties': return self.reply([dict(r) for r in db.execute('SELECT * FROM properties WHERE active=1')])
                if path=='/api/me': return self.reply(dict(user) if user else None)
                if not user: return self.reply({'error':'Entre na sua conta para continuar.'},401)
                uid=user['id']
                if path=='/api/admin':
                    if user['role']!='administrador': return self.reply({'error':'Acesso restrito.'},403)
                    return self.reply({'messages':[dict(r) for r in db.execute('SELECT * FROM messages ORDER BY id DESC')], 'users':[dict(r) for r in db.execute('SELECT id,name,email,role FROM users')], 'listings':[dict(r) for r in db.execute('SELECT * FROM properties')]})
                if path=='/api/account': return self.reply({'favorites':[r[0] for r in db.execute('SELECT property_id FROM favorites WHERE user_id=?',(uid,))], 'visits':[dict(r) for r in db.execute('SELECT v.*,p.title FROM visits v JOIN properties p ON p.id=v.property_id WHERE v.user_id=? ORDER BY day',(uid,))], 'listings':[dict(r) for r in db.execute('SELECT * FROM properties WHERE owner=?',(uid,))], 'requests':[dict(r) for r in db.execute('SELECT v.*,p.title,u.name,u.email FROM visits v JOIN properties p ON p.id=v.property_id JOIN users u ON u.id=v.user_id WHERE p.owner=? OR ?=1',(uid,1 if user['role']=='administrador' else 0))]})
                return self.reply({'error':'Recurso não encontrado.'},404)
        if path=='/' or path.endswith('.html'): self.path='/index.html'
        return super().do_GET()
    def do_POST(self):
        origin=self.headers.get('Origin')
        if origin and urlparse(origin).netloc!=self.headers.get('Host'): return self.reply({'error':'Origem inválida.'},403)
        try:
            size=int(self.headers.get('Content-Length','0'))
            if size>6000000: raise ValueError('Conteúdo muito grande.')
            data=json.loads(self.rfile.read(size)); path=urlparse(self.path).path
            if not isinstance(data,dict): raise ValueError('Dados inválidos.')
            with connect() as db:
                user=self.user(db)
                if path in ['/api/register','/api/login','/api/reset']:
                    db.execute('DELETE FROM attempts WHERE created<?',(time.time()-60,))
                    db.execute('DELETE FROM sessions WHERE expires<?',(time.time(),))
                    ip=self.client_address[0]
                    if db.execute('SELECT COUNT(*) FROM attempts WHERE ip=?',(ip,)).fetchone()[0]>=30: return self.reply({'error':'Muitas tentativas. Aguarde um minuto.'},429)
                    db.execute('INSERT INTO attempts VALUES(?,?)',(ip,time.time())); db.commit()
                    email=str(data.get('email','')).strip().lower(); pw=str(data.get('password',''))
                    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254: raise ValueError('Informe um e-mail válido.')
                    if path=='/api/register':
                        name=str(data.get('name','')).strip()
                        if len(name)<2 or len(name)>100 or len(pw)<8 or len(pw)>128: raise ValueError('Informe seu nome e uma senha de 8 a 128 caracteres.')
                        salt=secrets.token_hex(16); recovery=secrets.token_urlsafe(24)
                        try: db.execute('INSERT INTO users(name,email,salt,password,recovery) VALUES(?,?,?,?,?)',(name,email,salt,password(pw,salt),hashlib.sha256(recovery.encode()).hexdigest()))
                        except sqlite3.IntegrityError: raise ValueError('Este e-mail já está cadastrado.')
                        return self.reply({'recovery':recovery},201)
                    row=db.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
                    if path=='/api/reset':
                        if not row or not hmac.compare_digest(row['recovery'],hashlib.sha256(str(data.get('recovery','')).encode()).hexdigest()): raise ValueError('E-mail ou chave de recuperação inválidos.')
                        if len(pw)<8 or len(pw)>128: raise ValueError('Use uma senha de 8 a 128 caracteres.')
                        salt=secrets.token_hex(16); recovery=secrets.token_urlsafe(24)
                        db.execute('UPDATE users SET salt=?,password=?,recovery=? WHERE id=?',(salt,password(pw,salt),hashlib.sha256(recovery.encode()).hexdigest(),row['id'])); db.execute('DELETE FROM sessions WHERE user_id=?',(row['id'],))
                        return self.reply({'recovery':recovery})
                    if not row or not hmac.compare_digest(row['password'],password(pw,row['salt'])): return self.reply({'error':'E-mail ou senha incorretos.'},401)
                    token=secrets.token_urlsafe(32); db.execute('INSERT INTO sessions VALUES(?,?,?)',(token,row['id'],time.time()+86400))
                    secure='; Secure' if os.environ.get('DOMUS_SECURE_COOKIE')=='1' else ''
                    return self.reply({'ok':True},cookie=f'domus_session={token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400'+secure)
                if path=='/api/contact':
                    name=str(data.get('name','')).strip(); email=str(data.get('email','')).strip(); message=str(data.get('message','')).strip()
                    if not name or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(message)<10: raise ValueError('Preencha nome, e-mail e uma mensagem com pelo menos 10 caracteres.')
                    db.execute('INSERT INTO messages(name,email,message,created) VALUES(?,?,?,?)',(name[:100],email[:254],message[:5000],time.time())); return self.reply({'ok':True},201)
                if not user: return self.reply({'error':'Entre na sua conta para continuar.'},401)
                uid=user['id']
                if path=='/api/logout':
                    c=SimpleCookie(self.headers.get('Cookie','')); db.execute('DELETE FROM sessions WHERE token=?',(c['domus_session'].value,)); return self.reply({'ok':True},cookie='domus_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/')
                if path=='/api/favorite':
                    pid=int(data['id'])
                    if not db.execute('SELECT 1 FROM properties WHERE id=? AND active=1',(pid,)).fetchone(): raise ValueError('Imóvel indisponível.')
                    if data.get('saved'): db.execute('INSERT OR IGNORE INTO favorites VALUES(?,?)',(uid,pid))
                    else: db.execute('DELETE FROM favorites WHERE user_id=? AND property_id=?',(uid,pid))
                elif path=='/api/visit':
                    pid=int(data['id']); day=date.fromisoformat(data['day']); period=data['period']
                    if day<=date.today() or period not in ['Manhã','Tarde']: raise ValueError('Escolha uma data futura e um período válido.')
                    if not db.execute('SELECT 1 FROM properties WHERE id=? AND active=1',(pid,)).fetchone(): raise ValueError('Imóvel indisponível.')
                    try: db.execute('INSERT INTO visits(user_id,property_id,day,period) VALUES(?,?,?,?)',(uid,pid,day.isoformat(),period))
                    except sqlite3.IntegrityError: raise ValueError('Você já solicitou essa visita.')
                elif path=='/api/visit-status':
                    visit=db.execute('SELECT v.*,p.owner FROM visits v JOIN properties p ON p.id=v.property_id WHERE v.id=?',(int(data['id']),)).fetchone(); status=data.get('status')
                    if not visit or not ((visit['user_id']==uid and status=='Cancelada') or ((visit['owner']==uid or user['role']=='administrador') and status in ['Confirmada','Cancelada'])): return self.reply({'error':'Ação não permitida.'},403)
                    db.execute('UPDATE visits SET status=? WHERE id=?',(status,visit['id']))
                elif path=='/api/admin-role':
                    if user['role']!='administrador': return self.reply({'error':'Acesso restrito.'},403)
                    role=data.get('role')
                    if role not in ['cliente','corretor']: raise ValueError('Perfil inválido.')
                    db.execute("UPDATE users SET role=? WHERE id=? AND role!='administrador'",(role,int(data['id'])))
                elif path=='/api/listing':
                    fields=['title','city','neighborhood','type','purpose','description']; values=[str(data.get(k,'')).strip() for k in fields]
                    if any(not v or len(v)>3000 for v in values) or data['type'] not in ['Casa','Apartamento','Comercial'] or data['purpose'] not in ['Comprar','Alugar']: raise ValueError('Preencha todos os dados do imóvel.')
                    nums=[float(data.get(k,0)) for k in ['price','area']]+[int(data.get(k,0)) for k in ['rooms','baths','parking']]
                    if not all(0<=n<=1000000000 for n in nums) or nums[0]<=0 or nums[1]<=0: raise ValueError('Informe preço, área e quantidades válidas.')
                    previous=None
                    if data.get('id'):
                        previous=db.execute('SELECT * FROM properties WHERE id=? AND owner=?',(int(data['id']),uid)).fetchone()
                        if not previous: return self.reply({'error':'Anúncio não encontrado.'},404)
                    image=previous['image'] if previous else ''
                    if data.get('photo'):
                        raw=base64.b64decode(data['photo'],validate=True)
                        if len(raw)>4000000: raise ValueError('Use uma foto de até 4 MB.')
                        ext='png' if raw.startswith(b'\x89PNG\r\n\x1a\n') else 'jpg' if raw.startswith(b'\xff\xd8\xff') else None
                        if not ext: raise ValueError('Use uma imagem PNG ou JPEG.')
                        image='/uploads/'+secrets.token_hex(16)+'.'+ext
                        (ROOT/'web/uploads').mkdir(exist_ok=True)
                        (ROOT/'web'/image.lstrip('/')).write_bytes(raw)
                    if previous:
                        db.execute('UPDATE properties SET title=?,city=?,neighborhood=?,type=?,purpose=?,description=?,price=?,area=?,rooms=?,baths=?,parking=?,image=? WHERE id=?',values+nums+[image,previous['id']])
                    else:
                        db.execute('INSERT INTO properties(owner,title,city,neighborhood,type,purpose,description,price,area,rooms,baths,parking,image) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',[uid]+values+nums+[image])
                elif path=='/api/listing-status':
                    result=db.execute('UPDATE properties SET active=? WHERE id=? AND (owner=? OR ?=1)',(1 if data.get('active') else 0,int(data['id']),uid,1 if user['role']=='administrador' else 0))
                    if not result.rowcount: return self.reply({'error':'Anúncio não encontrado.'},404)
                else: return self.reply({'error':'Recurso não encontrado.'},404)
                return self.reply({'ok':True})
        except (ValueError,KeyError,TypeError,OverflowError) as exc: return self.reply({'error':str(exc) or 'Dados inválidos.'},400)
if __name__=='__main__':
    parser=argparse.ArgumentParser(); parser.add_argument('--port',type=int,default=3000); parser.add_argument('--host',default='127.0.0.1'); parser.add_argument('--strictPort',action='store_true'); parser.add_argument('--make-admin'); args=parser.parse_args()
    initialize()
    if args.make_admin:
        with connect() as db:
            updated=db.execute("UPDATE users SET role='administrador' WHERE email=?",(args.make_admin.strip().lower(),)).rowcount
        print('Administrador atualizado.' if updated else 'Cadastre este e-mail primeiro.'); raise SystemExit(0 if updated else 1)
    print(f'DOMUS: http://{args.host}:{args.port}',flush=True); ThreadingHTTPServer((args.host,args.port),Handler).serve_forever()
