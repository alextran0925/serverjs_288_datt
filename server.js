// Tham chiếu tập tin biến môi trường .env
require("dotenv").config();
// Tham chiếu đến thư viện http của node
const http = require("http");
// Tham chiếu đến thư viện fs của node
const fs = require("fs");
// Khai báo port cho  server
const port = process.env.PORT;
// Tham chiếu thư viện của libs/mongoDB
const db = require("./libs/mongoDB");
// Tham chiếu thư viện của libs/sendmail 
const sendMail = require("./libs/sendmail");
// Tham chiếu thư viện upload images 
const imgCloud = require("./libs/cloudinaryImages");

// Xây dựng Dịch vụ

const server = http.createServer((req, res) => {
    let method = req.method;
    let url = req.url;
    let results = {
        "noiDung": `Service Node JS - Method:${method} - Url:${url}`
    }
    // Cấp quyền
    res.setHeader("Access-Control-Allow-Origin", '*');
    res.setHeader("Access-Control-Allow-Methods", 'PUT, POST, OPTIONS,DELETE');
    res.setHeader("Access-Control-Allow-Credentials", true);
    // Lấy dữ liệu gởi từ client -> server: POST, PUT, DELETE
    let noi_dung_nhan = ``;
    req.on("data", (data) => {
        noi_dung_nhan += data;
    })
    switch (method) {
        case "GET":
            if (url.match("\.png$")) {
                let imagePath = `./images/${url}`;
                if (!fs.existsSync(imagePath)) {
                    imagePath = `./images/noImage.png`;
                }
                let fileStream = fs.createReadStream(imagePath);
                res.writeHead(200, { "Content-Type": "image/png" });
                fileStream.pipe(res);
                return;
            } else {
                let tmp = url.substring(1).split("/");
                let collectionName = db.collectionNames[tmp[0]];
                let filter = {};
                if (tmp.length != 1) {
                    filter = {
                        "Nhom.Ma_so": tmp[1].toUpperCase()
                    };
                }
                if (collectionName != undefined) {
                    db.getAll(collectionName, filter).then((result) => {
                        results.noiDung = result;
                        res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                        res.end(JSON.stringify(results));
                    })
                } else {
                    res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                    res.end(JSON.stringify(results));
                }
            }
            break;
        case "POST":
            if (url == "/ThemDienthoai") {
                req.on('end', function () {
                    let mobile = JSON.parse(noi_dung_nhan);
                    let ket_qua = { "Noi_dung": true };
                    db.insertOne("Mobile", mobile).then(result => {
                        console.log(result);
                        res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                        res.end(JSON.stringify(ket_qua));
                    }).catch(err => {
                        console.log(err);
                        ket_qua.Noi_dung = false;
                        res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                        res.end(JSON.stringify(ket_qua));
                    })
                })
            } else if (url == "/Dangnhap") {
                req.on("end", () => {
                    let ket_qua = {
                        "Noi_dung": true
                    }
                    let user = JSON.parse(noi_dung_nhan);
                    let filter = {
                        $and: [
                            { "Ten_Dang_nhap": user.Ten_Dang_nhap },
                            { "Mat_khau": user.Mat_khau }
                        ]
                    }
                    db.getOne("User", filter).then(result => {
                        console.log(result)
                        ket_qua.Noi_dung = {
                            "Ho_ten": result.Ho_ten,
                            "Nhom": {
                                "Ma_so": result.Nhom_Nguoi_dung.Ma_so,
                                "Ten": result.Nhom_Nguoi_dung.Ten
                            }
                        };
                        res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                        res.end(JSON.stringify(ket_qua));

                    }).catch(err => {
                        console.log(err);
                        ket_qua.Noi_dung = false;
                        res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                        res.end(JSON.stringify(ket_qua));
                    })
                })
            } else if (url == "/Lienhe") {
                req.on("end", () => {
                    let contact = JSON.parse(noi_dung_nhan);
                    let from = "admin@shop288.com";
                    let to = "trandatcdt@gmail.com";

                    let subject = contact.tieude;
                    let body = contact.noidung;
                    results = {
                        noiDung: true
                    }
                    sendMail.Goi_Thu_Lien_he(from, to, subject, body).then((result) => {
                        console.log(result)
                        res.end(JSON.stringify(results));
                    }).catch((err) => {
                        console.log(err);
                        results.noiDung = false;
                        res.end(JSON.stringify(results));
                    })
                })
            } else if (url == "/Dathang") {
                req.on("end", () => {
                    let dsDathang = JSON.parse(noi_dung_nhan);
                    let ket_qua = { "Noi_dung": [] };
                    dsDathang.forEach(item => {
                        let filter = {
                            "Ma_so": item.key
                        }
                        let collectionName = (item.nhom == 1) ? "Tivi" : (item.nhom == 2) ? "Mobile" : "Food";
                        db.getOne(collectionName, filter).then(result => {
                            item.dathang.So_Phieu_Dat = result.Danh_sach_Phieu_Dat.length + 1;
                            result.Danh_sach_Phieu_Dat.push(item.dathang);
                            // Update
                            let capnhat = {
                                $set: { Danh_sach_Phieu_Dat: result.Danh_sach_Phieu_Dat }
                            }
                            let obj = {
                                "Ma_so": result.Ma_so,
                                "Update": true
                            }
                            db.updateOne(collectionName, filter, capnhat).then(result => {
                                if (result.modifiedCount == 0) {
                                    obj.Update = false

                                }
                                ket_qua.Noi_dung.push(obj);
                                console.log(ket_qua.Noi_dung)
                                if (ket_qua.Noi_dung.length == dsDathang.length) {
                                    res.end(JSON.stringify(ket_qua));
                                }
                            }).catch(err => {
                                console.log(err)
                            })
                        }).catch(err => {
                            console.log(err);
                        })
                    })
                })
            } else if (url == "/ImagesDienthoai") {
                req.on('end', function () {
                    let img = JSON.parse(noi_dung_nhan);
                    let Ket_qua = { "Noi_dung": true };
                    // upload img in images Server ------------------------------
                    /*
                    let kq = saveMedia(img.name, img.src)
                    if (kq == "OK") {
                        res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
                        res.end(JSON.stringify(Ket_qua));
                    } else {
                        Ket_qua.Noi_dung = false
                        res.writeHead(200, { "Content-Type": "text/json; charset=utf-8" });
                        res.end(JSON.stringify(Ket_qua));
                    }*/

                    // upload img host cloudinary ------------------------------
                    
                    imgCloud.UPLOAD_CLOUDINARY(img.name,img.src).then(result=>{
                        console.log(result);
                        res.end(JSON.stringify(Ket_qua));

                    }).catch(err=>{
                        console.log(err);
                        Ket_qua.Noi_dung=false
                        res.end(JSON.stringify(Ket_qua))
                    })
                    
                })

            }
            else {
                res.end(JSON.stringify(results));
            }

            break;
        case "PUT":
            if (url == "/SuaDienthoai") {
                req.on("end", function () {
                    let mobile = JSON.parse(noi_dung_nhan);
                    let ket_qua = { "Noi_dung": true };
                    db.updateOne("Mobile", mobile.condition, mobile.Update).then(result => {
                        console.log(result);
                        res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                        res.end(JSON.stringify(ket_qua));
                    }).catch(err => {
                        console.log(err);
                        ket_qua.Noi_dung = false;
                        res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                        res.end(JSON.stringify(ket_qua))
                    })
                })
            } else {
                res.end(JSON.stringify(results));
            }

            break;
        case "DELETE":
            if (url == "/XoaDienthoai") {
                req.on("end", function () {
                    let mobile = JSON.parse(noi_dung_nhan);
                    let ket_qua = { "Noi_dung": true };
                    db.deleteOne("Mobile", mobile).then(result => {
                        console.log(result);
                        res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                        res.end(JSON.stringify(ket_qua));
                    }).catch(err => {
                        console.log(err);
                        ket_qua.Noi_dung = false;
                        res.writeHead(200, { "Content-Type": "text/json;charset=utf-8" });
                        res.end(JSON.stringify(ket_qua))
                    })
                })
            } else {
                res.end(JSON.stringify(results));
            }

            break;
        default:
            res.end(JSON.stringify(results));
            break;
    }


});

server.listen(port, () => {
    console.log(`Service run http://localhost:${port}`);
});
// Upload Media Folder: images-----------------------------------------------------------------
function decodeBase64Image(dataString) {
    var matches = dataString.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/),
        response = {};

    if (matches.length !== 3) {
        return new Error('Error ...');
    }

    response.type = matches[1];
    response.data = new Buffer(matches[2], 'base64');

    return response;
}

function saveMedia(Ten, Chuoi_nhi_phan) {
    var Kq = "OK"
    try {
        var Nhi_phan = decodeBase64Image(Chuoi_nhi_phan);
        var Duong_dan = "images//" + Ten
        fs.writeFileSync(Duong_dan, Nhi_phan.data);
    } catch (Loi) {
        Kq = Loi.toString()
    }
    return Kq
}
