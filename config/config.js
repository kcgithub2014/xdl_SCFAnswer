export const base_headers = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Content-Type': 'application/x-www-form-urlencoded',
  'Host': 'dt.itxdl.cn',
  'Origin': 'https://dt.itxdl.cn',
  'Pragma': 'no-cache',
  'Referer': 'https://dt.itxdl.cn/mobile/login',
  'Upgrade-Insecure-Requests': 1,
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
}
export const question_base_headers = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Content-Type': 'application/x-www-form-urlencoded',
  'Host': 'dt.itxdl.cn',
  'Origin': 'https://dt.itxdl.cn',
  'Pragma': 'no-cache',
  'Referer': 'https://dt.itxdl.cn/mobile/question',
  'Upgrade-Insecure-Requests': 1,
  'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1'
}
export const query_base_headers = {
  'Accept': '*/*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  'Host': 'www.lihaijiang.top',
  'Origin': 'https://www.lihaijiang.top',
  'Pragma': 'no-cache',
  'Referer': 'https://www.lihaijiang.top/',
  'User-AgentUser-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36',
  'X-Requested-With': 'XMLHttpRequest'
}
export const historyBack = '<a style="display: block;width: 100%;height: 46px;text-align: center;background-color: #e64340;border-radius: 5px;line-height: 46px;color: #FFFFFF;" href="#" onClick="javascript:history.go(-1);return false;">返回上一页</a>'
export const origin = 'https://dt.itxdl.cn/mobile'

export const hjorigin = 'https://www.lihaijiang.top/home/index'

export const urls = {
  origin,
  login: `${origin}/login`,
  question: `${origin}/question`,
  query: `${hjorigin}/haijiang`,
  search: `${hjorigin}/search.html`,
  searchAll: `${hjorigin}/searchAll`}
