const myHeaders = new Headers();
myHeaders.append("Host", " latin-words.com");
myHeaders.append("User-Agent", " Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0");
myHeaders.append("Accept", " */*");
myHeaders.append("Accept-Language", " en-US,en;q=0.5");
myHeaders.append("Accept-Encoding", " gzip, deflate, br, zstd");
myHeaders.append("X-Requested-With", " XMLHttpRequest");
myHeaders.append("DNT", " 1");
myHeaders.append("Connection", " keep-alive");
myHeaders.append("Referer", " https://latin-words.com/");
myHeaders.append("Sec-Fetch-Dest", " empty");
myHeaders.append("Sec-Fetch-Mode", " cors");
myHeaders.append("Sec-Fetch-Site", " same-origin");
myHeaders.append("Priority", " u=0");

const requestOptions = {
  method: "GET",
  headers: myHeaders,
  redirect: "follow"
};

fetch("https://latin-words.com/cgi-bin/translate.cgi?query=audio", requestOptions)
  .then((response) => response.text())
  .then((result) => console.log(result))
  .catch((error) => console.error(error));