'use strict'
import path from 'path'
import fs from 'fs'
import request from 'superagent'
import cheerio from 'cheerio'
import bodyParser from 'body-parser'
import express from 'express'
import ejs from 'ejs'
import {base_headers, query_base_headers, urls, question_base_headers, historyBack} from './config/config.js'

let app = express()
    ,userData
    ,cookie
    ,errHtml

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.set("view engine", "ejs")
app.set("views", __dirname+'/html')
app.listen(8080)


app.get('/', (req, res) => {
  fs.readFile(path.join(__dirname, 'html/index.html'),{encoding:'utf-8',flag:'r'},(err, data) => {
    if(err) res.send(err)
    else res.send(data)
  })
})

app.post('/tklength', (req, res) => {
    let XLHDataLength
        ,data = fs.readFileSync(path.join(__dirname, 'data/tk.json'))
        ,SCFADataLength = JSON.parse(data)["tk"].length
    getXLHDataLength()
        .then(result => {
            XLHDataLength = result.body.length
            res.send({'SCFADataLength': SCFADataLength, 'XLHDataLength': (XLHDataLength ? XLHDataLength : 0)})
        })
        .catch(err => {
            res.send({'SCFADataLength': SCFADataLength, 'XLHDataLength': (XLHDataLength ? XLHDataLength : 0)})
        })
})

getErrHtml()
    .then(res => {
        errHtml = res
    })

app.post('/login', (req, res) => {
  let time = new Date()
      ,h = time.getHours()
      ,m = time.getMinutes()
  if(h < 8){
      res.send(errHtml)
      return
  }else if(h == 8 && m < 10){
      res.send(errHtml)
      return
  }

  userData = {
    "_token": "",
    "tel": req.body.tel,
    "password": req.body.password,
    "tk": req.body.tk
  }
  getDtPage()
    .then(login)
    .then(getQuestion)
    .then(findQ)
    .then(countQ)
    .then(getDA)
    .then(result => {
      if(typeof result == 'string'){
          let $ = cheerio.load(result)
              $('head script').html('')
              $('header').remove()
              $('.top-15').html(historyBack)
        res.render('result.ejs',{result: $('html').html()})
        return
      }
      let cookie = result[result.length-1].substr(result[result.length-1].lastIndexOf('laravel_session=')+16)
      res.cookie('laravel_session', cookie)
      res.render('dt.ejs', {result: result})
    })
    .catch(err => {
      res.send(err)
    })
})

app.post('/answer', (req, res) => {
  let cookie = decodeURI(req.headers.cookie.match(/(laravel_session=.+)/)[1])
      ,data = req.body
      ,tel = req.body.tel
      ,password = req.body.password
      ,_token = req.body._token
  delete data['tel']
  delete data['password']
  try{
      request
          .post(urls.question)
          .set(question_base_headers)
          .set('Cookie', cookie)
          .type('form')
          .send(data)
          .redirects(0)
          .end((err, result) => {
              if(err.response.statusCode == 200) {
                  saveDT(result, cookie, false)
                      .then(result => {
                          let $ = cheerio.load(result)
                          $('head script').html('')
                          $('header').remove()
                          $('.top-15').html(historyBack)
                          res.render('result.ejs',{result: $('html').html()})
                      })
                      .catch(err => {
                          res.send('2017/11/10 修改，有待测试，此报错不影响提交')
                          console.log(err)
                      })
              }
              else{
                  res.send('服务器内部错误！请联系管理员')
              }
          })
  }catch (e){
      res.send('提交答案错误！请联系管理员')
  }
})

function getErrHtml(){
    return new Promise((resolve, reject) => {
        fs.readFile(path.join(__dirname, 'html/err.html'),{encoding:'utf-8',flag:'r'},(err, data) => {
            if(err) reject(err)
            else resolve(data)
        })
    })
}

function getXLHDataLength(){
    return new Promise((resolve, reject) => {
        request
            .post(urls.searchAll)
            .set(query_base_headers)
            .end((err, res) => {
                if(err) reject(err)
                else resolve(res)
            })
    })
}
function saveDT(res, cookie, is){
      let href
      if(!is){
        let $ = cheerio.load(res.text)
        href = 'https://dt.itxdl.cn'+ $('.weui-btn_primary').attr('href')
      }else{
        href = 'https://dt.itxdl.cn'+ res
      }
    return new Promise((resolve, reject) => {
      request
          .get(href)
          .set(base_headers)
          .set('Cookie', cookie)
          .end((err, res) => {
            if(err) reject(err)
            else{
                resolve(res.text)
              let $ = cheerio.load(res.text)
                  ,title = $('.weui-cells__title')
                  ,result
              fs.readFile(path.join(__dirname, 'data/tk.json'), 'utf8', (err, data) => {
                if(err) console.log(err)
                else{
                  result = JSON.parse(data)
                  $(title).each((idx, elm) => {
                    let _q = $(elm).text().replace(/^\d\./, '')
                        ,type = _q.match(/[\u591a\u5355]\u9009\u9898/g)
                        ,q = _q.replace(/\u0028\u0020[\u5355\u591a]\u9009\u9898\u0020\u0029/g, '').replace(/(\s+$)/, '')
                        ,_a = trimSpace($(elm).next().find('.weui-icon-success').next().text().split(/[A-Z]\.\s/)).map(v => v.replace(/(\s+$)/, ''))
                        ,is = 0
                    result["tk"].forEach((val) => {
                      if(val['title'] == q){
                        is = 1
                      }
                    })
                    if(!is){
                      result["tk"].push({'title': q, 'type': type, 'answer': _a})
                    }
                  })
                  fs.writeFile(path.join(__dirname, 'data/tk.json'), JSON.stringify(result), (err) => {
                    if(err) reject(err)
                  })
                }
              })
            }
          })
    })
}




function login(res){
  let token = getToken(res.text)
  userData._token = token
  cookie = res.headers['set-cookie'].join(',').match(/(laravel_session=.+?);/)[1]
  return new Promise((resolve, reject) => {
    console.log(`${userData.tel}${userData.password}请求登录...`)
    request
      .post(urls.login)
      .set(base_headers)
      .set('Cookie', cookie)
      .type('form')
      .send(userData)
      .redirects(0)
      .end((err, res) => {
        if(err){
          console.log(`${userData.tel}登录失败...`)
          if(err.status == 302){
            reject('手机号或密码错误！')
          }else{
              reject(err)
          }
        }else{
            console.log(`${userData.tel}登录成功，开始拉取题目...`)
            resolve([res, userData, cookie])
        }
      })
  })
}

function getToken(s){
  let $ = cheerio.load(s)
  return $('#login_form input[name="_token"]').val()
}

function getDtPage(){
  return new Promise((resolve, reject) => {
    request
      .get(urls.login)
      .end((err, res) => {
        if(err) reject(err)
        else resolve(res)
      })
  })
}

function getQuestion(r){
  return new Promise((resolve, reject) => {
    request
      .get(urls.question)
      .set('Cookie', r[2])
      .end((err, res) => {
        if(err){
          console.log(`${r[1].tel}拉取题目失败...`)
          reject(err)
        }
        if(res.req.path.length > 17){
          saveDT(res.req.path, r[2], true)
              .then(result => {
                  resolve(result)
              })
              .catch(err => {
                  resolve('err')
              })
            return
        }else{
          console.log(`${r[1].tel}拉取题目成功，开始查询答案...`)
        }
          resolve([res, r[1], r[2]])
      })
  })
}

function findQ(res){
    if(typeof res == 'string'){
        return new Promise((resolve, reject) => {
            resolve(res)
        })
    }
  let $ = cheerio.load(res[0].text)
    ,QArr = trimSpace($('.weui-cells__title').text().replace(/[\s\uff1f\u70b9\u8d5e\u0028\u62cd\u7816\u0029]/g, "").split(/[0-9]\./))
    ,_ti = $('.weui-cells__title')
    ,_res = res[1]['tk']
    ,options
    ,reg = new RegExp("\[\\u5355\\u9009\\u9898\\u591a\\u9009\\u9898\]","g")
    ,pts = []
    QArr.forEach((Q, idx) => pts.push( new Promise((resolve, reject ) => {
        Q = Q.substring(0, Q.lastIndexOf('选题')+2)
        request
          .post(urls.query)
          .set(query_base_headers)
          .send({"haijiang": Q.substr(0, 2)})
          .end((err, res) => {
            if(err) reject(err)
            else resolve(res)
          })
        }).then(res => {
          let result = {}
              ,cacheQ = Q.substring(0, Q.lastIndexOf('选题')-2)
              ,label = $('.weui-cells__title:contains('+cacheQ.substr(0, 5)+')').next().find('label')
              ,name = $(label).eq(0).find('input').attr('name')
              ,arr = []
          $(label).each((idx, elm) => {
            let val = $(elm).find('input').val()
                ,text
            if($(elm).find('span')[0]){
              text = $(elm).find('span').text().replace(/^[A-Z]\.\s/, "")
              arr.push({[val]: text, "type": 'span'})

            }else if($(elm).find('img')[0]){
              text = $(elm).find('img').attr('src')
              arr.push({[val]: text, "type": 'img'})

            }
          })
          if(res.body.length){
              res.body.forEach(T => {
              let _Q = conversionT(Q)
              ,_T = T.title.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/\s/g, "").replace(/[\uff1f\?]/g, "")
              if(!result.hasOwnProperty(Q)) result[Q] = {'hjtitle':[_T]}
              else result[Q]['hjtitle'].push(_T)
            })
          }else{
            result[Q] = {'hjtitle': []}
          }
          result[Q]['name'] = name
          result[Q]['value'] = arr
            // 查询七色花题库
            if(contains(_res, '1')){
                let data = fs.readFileSync(path.join(__dirname, 'data/tk.json'))
                data = JSON.parse(data)
                $(_ti).each((_idx, elm) => {
                    if(idx == _idx){
                        let qq = $(elm).text().replace(/(^\s+)/, "").replace(/^\d\./, '')
                            ,strindex = (/\u0028\u0020[\u5355\u591a]\u9009\u9898\u0020\u0029/).exec(qq)['index']
                            ,_qq = qq.substring(0, strindex).replace(/(\s+$)/, "")
                        data['tk'].forEach((val) => {
                            if(val['title'] == _qq){
                                result[Q]['SCFA'] = val['answer']
                            }
                        })
                    }
                })
            }
            return result
      }))
    )
  pts.push(res[1],res[2])
  return Promise.all(pts)
}

function countQ(r){
    if(typeof r == 'string'){
        return new Promise((resolve, reject) => {
            resolve(r)
        })
    }
  let result = []
      ,res = r.slice(0, r.length-2)
  return new Promise((resolve, reject) => {
    res.forEach(val => {
      for(let x in val){
        let max = 0
          ,pos = 0
          ,type = x.match(/[\u591a\u5355]\u9009\u9898/g)
          ,_x = conversionT(x)
        if(val[x]['hjtitle'].length){
          val[x]['hjtitle'].forEach((value, index) => {
            let v = strSimilarity2Percent(value, _x)
            v > max ? (max = v,pos = index) : ''
          })
          if(max >= 50){
            let tm = Object.assign(val[x], {'hjtitle': val[x]['hjtitle'][pos]}, {'degree':max}, {'type':type[0]})
            result.push({[_x]: tm})
          }else{
            let tm = Object.assign(val[x], {'hjtitle': ''}, {'degree':max}, {'type':type[0]})
            result.push({[_x]: tm})
          }
        }
      }
    })
    result.push(r[r.length-1],r[r.length-2])
    resolve(result)
  })
}

function getDA(r){
    if(typeof r == 'string'){
        return new Promise((resolve, reject) => {
            resolve(r)
        })
    }
  let pts = []
      ,result = r.slice(0, r.length-2)
  result.forEach(Q => {
    for(let x in Q){
      pts.push( new Promise((resolve, reject) => {
        if(Q[x]['hjtitle']){
          let kh = Q[x]['hjtitle'].indexOf('(')
              ,tmx = Q[x]['hjtitle']
          if(kh > 0){
            tmx = Q[x]['hjtitle'].substr(0, kh)
          }
          request
            .post(urls.search)
            .set(query_base_headers)
            .send({"kw": tmx})
            .end((err, res) => {
              if(err) reject(err)
              else resolve(res)
            })
        }else{
          resolve('')
        }
      }).then((res) => {
        if(res.body){
          let $ = cheerio.load(res.text)
              ,solutionArr = $('.answer span').text()
          if(solutionArr.indexOf('<br>')>-1){
            solutionArr = solutionArr.split(/<br[^>]*>\d/)
          }else{
            solutionArr = solutionArr.split(/\s\d/)
          }
          if(solutionArr.length>1){
            solutionArr = solutionArr.map(i => i.replace(/^\d{1}/, ''))
          }
          if($('.answer span').text()){
            Q[x]['result'] = true
          }else{
            Q[x]['result'] = false
          }
          Q[x]['solution'] = solutionArr
        }else{
          Q[x]['solution'] = []
        }
        Q[x]['hjtitle'] = Q[x]['hjtitle'].replace(/"/g, '“')
        return result
        })
      )
    }
  })
  pts.push(r[r.length-1], r[r.length-2])
  return Promise.all(pts)
}

function conversionT(t){
  return qj2bj(t.replace(/[\u591a\u5355]\u9009\u9898/g, ""))
}

function contains(arr, obj) {
  var i = arr.length;
  while (i--) {
    if (arr[i] === obj) {
      return true;
    }
  }
  return false;
}

function trimSpace(array){
  for(let i=0;i<array.length;i++){
    if(array[i] == "" || typeof(array[i]) == "undefined" || array[i] == " "){
      array.splice(i,1)
      i-=1
    }
  }
  return array
}

function qj2bj(str){
  let tmp = ""
  for(let i=0;i<str.length;i++){
    if(str.charCodeAt(i) >= 65281 && str.charCodeAt(i) <= 65374){
      tmp += String.fromCharCode(str.charCodeAt(i)-65248)
    }else if(str.charCodeAt(i) == 12288){
      tmp += ' '
    }else{
      tmp += str[i]
    }
  }
  return tmp
}

function strSimilarity2Number(s, t){
  var n = s.length, m = t.length, d=[];
  var i, j, s_i, t_j, cost;
  if (n == 0) return m;
  if (m == 0) return n;
  for (i = 0; i <= n; i++) {
    d[i]=[];
    d[i][0] = i;
  }
  for(j = 0; j <= m; j++) {
    d[0][j] = j;
  }
  for (i = 1; i <= n; i++) {
    s_i = s.charAt (i - 1);
    for (j = 1; j <= m; j++) {
      t_j = t.charAt (j - 1);
      if (s_i == t_j) {
        cost = 0;
      }else{
        cost = 1;
      }
      d[i][j] = Minimum (d[i-1][j]+1, d[i][j-1]+1, d[i-1][j-1] + cost);
    }
  }
  return d[n][m];
}

function strSimilarity2Percent(s, t){
  var l = s.length > t.length ? s.length : t.length;
  var d = strSimilarity2Number(s, t);
  return (1-d/l).toFixed(4)*100;
}

function Minimum(a,b,c){
  return a<b?(a<c?a:c):(b<c?b:c);
}
