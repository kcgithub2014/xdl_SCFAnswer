'use strict'
import path from 'path'
import fs from 'fs'
import request from 'superagent'
import cheerio from 'cheerio'
import bodyParser from 'body-parser'
import express from 'express'
import querystring from 'querystring'
import ejs from 'ejs'
import {base_headers, query_base_headers, origin, hjorigin, urls} from './config/config.js'
import {question_base_headers} from "./config/config";

let app = express()
    ,http = require('http').Server(app)
    ,io = require('socket.io')(http)
    ,userData
    ,cookie

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.set("view engine", "ejs")
app.set("views", __dirname+'/html')
app.listen(8080, '192.168.137.188')

http.listen(3000,function(){
  console.log('正在监听3000')
})

io.on('connection',(socket) => {
  console.log('一个新的连接')
})

app.get('/', (req, res) => {
  fs.readFile(path.join(__dirname, 'html/index.html'),{encoding:'utf-8',flag:'r'},(err, data) => {
    if(err) console.log(err)
      else res.send(data)
  })
})

app.post('/login', (req, res) => {
  userData = {
    "_token": "",
    "tel": req.body.tel,
    "password": req.body.password
  }
  getDtPage()
    .then(login)
    .then(getQuestion)
    .then(findQ)
    .then(countQ)
    .then(getDA)
    .then(result => {
      if(result == 'ok'){
        res.send('<span style="color:#C11920;font-size:20px;">你已答题，正在向题库添加答案</span>')
        return
      }
      let cookie = result[result.length-1].substr(result[result.length-1].lastIndexOf('laravel_session=')+16)
      res.cookie('laravel_session', cookie)
      res.render('dt.ejs', {result: result})
    })
})

app.post('/answer', (req, res) => {
  let cookie = req.headers.cookie.match(/(laravel_session=.+)/)[1]
      ,data = req.body
      ,tel = req.body.tel
      ,password = req.body.password
      ,_token = req.body._token
  console.log(cookie)
  delete data['tel']
  delete data['password']
  res.send('ok')
  request
        .post(urls.question)
        .set(question_base_headers)
        .set('Cookie', cookie)
        .type('form')
        .send(data)
        .redirects(0)
        .end((err, result) => {
          if(err) console.log(err)
          else{
            saveDT(res, cookie, false)
          }
        })
})


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
            if(err) console.log(err)
            else{
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
                    if(err) console.log(err)
                    else resolve('ok')
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
    console.log(`${userData.tel}请求登录...`)
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
          return reject(err)
        }
        console.log(`${userData.tel}登录成功，开始拉取题目...`)
        resolve([res, userData, cookie])
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
          return reject(err)
        }
        if(res.req.path.length > 17){

          saveDT(res.req.path, r[2], true)
          resolve('ok')
        }else{
          console.log(`${r[1].tel}拉取题目成功，开始查询答案...`)
          resolve([res, r[1], r[2]])
        }
      })
  })
}

function findQ(res){
  if(res == 'ok'){
    return new Promise((resolve, reject) => {
      resolve('ok')
    })
  }
  let $ = cheerio.load(res[0].text)
    ,QArr = trimSpace($('.weui-cells__title').text().replace(/[\s\uff1f\u70b9\u8d5e\u0028\u62cd\u7816\u0029]/g, "").split(/[0-9]\./))
    ,options
    ,reg = new RegExp("\[\\u5355\\u9009\\u9898\\u591a\\u9009\\u9898\]","g")
    ,pts = []
    QArr.forEach(Q => pts.push( new Promise((resolve, reject ) => {
        Q = Q.substring(0, Q.lastIndexOf('选题')+2)
        request
          .post(urls.query)
          .set(query_base_headers)
          .send({"haijiang": Q.substr(0, 2)})
          .end((err, res) => {
            if(err) rejcet(err)
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
          return result
      }))
    )
  pts.push(res[1],res[2])
  return Promise.all(pts)
}

function countQ(r){
  if(r == 'ok'){
    return new Promise((resolve, reject) => {
      resolve('ok')
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
  if(r == 'ok'){
    return new Promise((resolve, reject) => {
      resolve('ok')
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


// function FQ(title){
//   let data = {"kw": ""}
//     ,DTtitle
//   if(typeof title === 'object'){
//     for(let x in title){
//       data["kw"] = title[x]
//       DTtitle = x
//     }
//   }
//   if(typeof title === 'string'){
//     data["kw"] = DTtitle = title
//   }
//   request
//     .post(urls.search)
//     .set(query_base_headers)
//     .send(data)
//     .end((err, res) => {
//       if(err){
//         console.log(`${userData.tel}查询答案失败啦~失败啦~败啦~啦`)
//         return err
//       }
//       let $ = cheerio.load(res.text)
//       DT.push({[DTtitle]: $('.answer span').text()})
//     })
// }
//
// function findQ(res){
//   let $ = cheerio.load(res.text)
//     QArr = trimSpace($('.weui-cells__title').text().replace(/[\s\uff1f\u70b9\u8d5e\u0028\u62cd\u7816\u0029]/g, "").split(/[0-9]\./))
//   for(let i = 0;i<QArr.length;i++){
//     let reg = new RegExp("\[\\u5355\\u9009\\u9898\\u591a\\u9009\\u9898\]","g")
//       ,str = QArr[i].replace(reg, "").replace(/[0-9]/g, "")
//       ,x = 2
//     request
//       .post(urls.query)
//       .set(query_base_headers)
//       .send({"haijiang": str.substr(0, x)})
//       .end((err, res) => {
//         if(err){
//           console.log(`${userData.tel}查询题目失败啦~失败啦~败啦~啦`)
//           return 'error'
//         }
//         if(res.body.length > 1) FT(str, x+res.body.length/2 | 0)
//         if(res.body.length < 1) FT(str, x/2 | 0)
//         if(x === 0) NQ = i
//         if(res.body.length === 1) {
//           let t = qj2bj(res.body[0].title.replace(/&quot;/g, '“').replace(/\s/g, ""))
//             ,_str = qj2bj(str.replace(/\s/g, ""))
//             ,CD = {[_str]: t}
//           if(strSimilarity2Percent(_str, t) > 80){
//             FQ(res.body[0].title.replace(/&quot;/g,'"'))
//           }
//           if(strSimilarity2Percent(_str, t) < 80){
//             CacheData.push(CD)
//           }
//         }
//       })
//   }
// }
// app.get('/question', (req, res) => {
//   let html = `<html><head><meta charset="utf-8"><title>七色花答题页</title></head>
//                 <body><form action="/userAnswer" method="post"><p>`
//   if(CacheData.length){
//     for(let i=0;i<CacheData.length;i++){
//       html += `${JSON.stringify(CacheData[i])}<br><input type="radio" name="${i}" value="y">相同 <br><input type="radio" name="${i}" value="n">不相同</p>`
//     }
//     html += `<input type="submit" value="提交"></form></body></html>`
//   }else{
//     html += `没有不同~</p><input type="submit" value="提交"></form></body></html>`
//   }
//   res.send(html)
// })

// app.post('/userAnswer',(req, res) => {
//   if(JSON.stringify(req.body) == '{}'){
//     res.redirect('/startAnswer')
//     return
//   }
//   for(let k in req.body){
//     if(req.body[k] === 'y'){
//       for(let x in CacheData[k]){
//         FQ(CacheData[k])
//         setTimeout(() => {
//           res.redirect('/startAnswer')
//         },5000)
//         return
//       }
//     }
//     if(req.body[k] === 'n'){
//       return
//     }
//   }
// })

// app.get('/startAnswer',(req, res) => {
//   let $ = cheerio.load(questionData.text)
//     ,reg = new RegExp("\[\\u5355\\u9009\\u9898\\u591a\\u9009\\u9898\]","g")
//     ,label
//   $('.weui-cells__title').each((idx, elm) => {
//     let t = qj2bj($(elm).text().replace(/[\s\uff1f\u70b9\u8d5e\u0028\u62cd\u7816\u00290-9\.]/g, "").replace(reg, ""))
//       ,QType = $(elm).text().match(reg).join('')
//     for(let i=0;i<DT.length;i++){
//       for(let x in DT[i]){
//         let _x = qj2bj(x).replace(/"/g, '“').replace(/\s/g, "")
//           ,jieguo
//         if(strSimilarity2Percent(t, _x)> 60){
//           label = $(elm).next().children()
//           $(label).each((idx, elm) => {
//             let xuanxiang = qj2bj($(elm).find('span').text().replace(/[a-zA-Z]\.\s/g, "")).replace(/"/g, '“')
//             // console.log($(elm).find('input').attr('name')+'   '+$(elm).find('input').val()+'   '+$(elm).find('span').text())
//             if(QType.indexOf('多选题') > -1){
//               jieguo = DT[i][x].toLocaleUpperCase().replace(/[0-9]/g, "").split(' ')
//               if(contains(jieguo, xuanxiang)){
//                 if(DA.hasOwnProperty($(elm).find('input').attr('name'))){
//                   DA[$(elm).find('input').attr('name')] += $(elm).find('input').val()
//                 }else{
//                   DA[$(elm).find('input').attr('name')] = $(elm).find('input').val()
//                 }
//               }
//             }else{
//               jieguo = DT[i][x]
//               if(strSimilarity2Percent(xuanxiang, DT[i][x]) == 100){
//                 DA[$(elm).find('input').attr('name')] = $(elm).find('input').val()
//               }
//             }
//           })
//         }
//       }
//     }
//     console.log(DA)
//   })
//   // console.log(DT)

// })