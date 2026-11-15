import http.client, json, tempfile, threading, unittest
from datetime import date, timedelta
import server
class Flows(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();server.DB=cls.tmp.name+'/test.sqlite3';server.initialize()
        cls.http=server.ThreadingHTTPServer(('127.0.0.1',0),server.Handler)
        threading.Thread(target=cls.http.serve_forever,daemon=True).start()
    @classmethod
    def tearDownClass(cls): cls.http.shutdown();cls.http.server_close();cls.tmp.cleanup()
    def call(self,path,data=None,cookie='',origin=None):
        c=http.client.HTTPConnection('127.0.0.1',self.http.server_port); headers={'Cookie':cookie}
        if origin: headers['Origin']=origin
        if data is not None: headers['Content-Type']='application/json'
        c.request('POST' if data is not None else 'GET','/api/'+path,json.dumps(data) if data is not None else None,headers)
        r=c.getresponse(); result=(r.status,json.loads(r.read()),r.getheader('Set-Cookie') or '');c.close();return result
    def test_full_journey_and_authorization(self):
        self.assertEqual(self.call('account')[0],401)
        self.assertGreaterEqual(len(self.call('properties')[1]),6)
        user={'name':'Teste Cliente','email':'cliente@example.test','password':'Teste-seguro-123'}
        status,body,_=self.call('register',user);self.assertEqual(status,201);recovery=body['recovery']
        self.assertEqual(self.call('register',user)[0],400)
        self.assertEqual(self.call('login',{**user,'password':'errada'})[0],401)
        _,_,cookie=self.call('login',user);self.assertIn('HttpOnly',cookie)
        self.assertEqual(self.call('me',cookie=cookie)[1]['name'],user['name'])
        self.assertEqual(self.call('favorite',{'id':1,'saved':True},cookie)[0],200)
        self.assertEqual(self.call('account',cookie=cookie)[1]['favorites'],[1])
        self.assertEqual(self.call('favorite',{'id':999,'saved':True},cookie)[0],400)
        day=(date.today()+timedelta(days=3)).isoformat();visit={'id':1,'day':day,'period':'Manhã'}
        self.assertEqual(self.call('visit',visit,cookie)[0],200)
        self.assertEqual(self.call('visit',visit,cookie)[0],400)
        self.assertEqual(self.call('visit',{**visit,'day':'2000-01-01'},cookie)[0],400)
        vid=self.call('account',cookie=cookie)[1]['visits'][0]['id']
        self.assertEqual(self.call('visit-status',{'id':vid,'status':'Confirmada'},cookie)[0],403)
        self.assertEqual(self.call('visit-status',{'id':vid,'status':'Cancelada'},cookie)[0],200)
        listing={'title':'Casa teste','city':'Uberlândia','neighborhood':'Centro','type':'Casa','purpose':'Comprar','price':500000,'area':120,'rooms':2,'baths':2,'parking':1,'description':'Uma casa de teste.'}
        self.assertEqual(self.call('listing',listing,cookie)[0],200)
        pid=self.call('account',cookie=cookie)[1]['listings'][0]['id']
        other={'name':'Outro Cliente','email':'outro@example.test','password':'Outra-senha-123'}
        self.call('register',other);_,_,othercookie=self.call('login',other)
        self.assertEqual(self.call('listing-status',{'id':pid,'active':False},othercookie)[0],404)
        self.assertEqual(self.call('visit',{'id':pid,'day':day,'period':'Tarde'},othercookie)[0],200)
        req=self.call('account',cookie=cookie)[1]['requests'][0]
        self.assertEqual(self.call('visit-status',{'id':req['id'],'status':'Confirmada'},cookie)[0],200)
        self.assertEqual(self.call('listing-status',{'id':pid,'active':False},cookie)[0],200)
        self.assertNotIn(pid,[p['id'] for p in self.call('properties')[1]])
        self.assertEqual(self.call('contact',{'name':'Pessoa','email':'p@example.test','message':'Mensagem de teste para Domus.'})[0],201)
        self.assertEqual(self.call('favorite',{'id':1,'saved':False},cookie,origin='https://evil.test')[0],403)
        self.assertEqual(self.call('reset',{**user,'recovery':'errada'})[0],400)
        _,reset,_=self.call('reset',{**user,'recovery':recovery,'password':'Nova-senha-123'})
        self.assertIn('recovery',reset);self.assertIsNone(self.call('me',cookie=cookie)[1])
        self.assertEqual(self.call('login',user)[0],401)
        _,_,cookie=self.call('login',{**user,'password':'Nova-senha-123'})
        self.assertEqual(self.call('account',cookie=cookie)[1]['favorites'],[1])
        self.call('logout',{},cookie);self.assertIsNone(self.call('me',cookie=cookie)[1])
        with server.connect() as db:
            row=db.execute('SELECT password FROM users WHERE email=?',(user['email'],)).fetchone()
            self.assertNotEqual(row['password'],'Nova-senha-123')
    def test_edit_and_admin_permissions(self):
        user={'name':'Editor','email':'editor@example.test','password':'Senha-editor-123'}
        self.call('register',user);_,_,cookie=self.call('login',user)
        listing={'title':'Anúncio editável','city':'Uberlândia','neighborhood':'Centro','type':'Casa','purpose':'Comprar','price':400000,'area':90,'rooms':2,'baths':1,'parking':1,'description':'Descrição de teste.'}
        self.assertEqual(self.call('listing',listing,cookie)[0],200)
        pid=self.call('account',cookie=cookie)[1]['listings'][0]['id']
        self.assertEqual(self.call('listing',{**listing,'id':pid,'title':'Título atualizado'},cookie)[0],200)
        self.assertEqual(self.call('account',cookie=cookie)[1]['listings'][0]['title'],'Título atualizado')
        self.assertEqual(self.call('listing',{**listing,'id':1},cookie)[0],404)
        self.assertEqual(self.call('listing',{**listing,'photo':'bm90IGFuIGltYWdl'},cookie)[0],400)
        self.assertEqual(self.call('admin',cookie=cookie)[0],403)
        self.assertEqual(self.call('admin-role',{'id':1,'role':'corretor'},cookie)[0],403)
        with server.connect() as db: db.execute("UPDATE users SET role='administrador' WHERE email=?",(user['email'],))
        self.assertEqual(self.call('admin',cookie=cookie)[0],200)
        self.assertEqual(self.call('admin-role',{'id':1,'role':'administrador'},cookie)[0],400)
        self.assertEqual(self.call('listing-status',{'id':pid,'active':False},cookie)[0],200)
    def test_validation(self):
        self.assertEqual(self.call('register',{'name':'A','email':'invalid','password':'123'})[0],400)
        self.assertEqual(self.call('contact',{'name':'A','email':'invalid','message':'hello'})[0],400)
        self.assertEqual(self.call('listing',{})[0],401)
    def test_static_isolation(self):
        for path in ['/server.py','/domus.sqlite3','/.git/config']:
            c=http.client.HTTPConnection('127.0.0.1',self.http.server_port);c.request('GET',path);r=c.getresponse();self.assertEqual(r.status,404);r.read();c.close()
if __name__=='__main__':unittest.main()
