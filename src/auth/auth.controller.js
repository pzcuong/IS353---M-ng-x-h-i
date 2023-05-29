const userModel = require('../users/users.models');
const authMethod = require('../auth/auth.methods');
var randToken = require('rand-token');
const bcrypt = require('bcryptjs'); 
const { config } = require('dotenv');
require('dotenv').config();

const SALT_ROUNDS = 10;

async function createToken(username, refreshToken) {
    const accessTokenLife = process.env.ACCESS_TOKEN_LIFE;
    const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
    const dataForAccessToken = {
        username: username
    };
    const accessToken = await authMethod.generateToken(
        dataForAccessToken,
        accessTokenSecret,
        accessTokenLife
    );
    if (!accessToken)
        return ({ 
            statusCode: 401, 
            message: 'Tạo access token không thành công, vui lòng thử lại!' 
        });

    if (refreshToken == null) {
        let refreshToken = randToken.generate(24); 
        await userModel.updateRefreshToken(username, refreshToken);
    } else 
        refreshToken = refreshToken;

    return ({
        statusCode: 200,
        message: 'Tạo access token thành công',
        accessToken: accessToken,
        refreshToken: refreshToken,
        username: username,
    });
}

async function login(req, res, next) {
    try {
        const username = req.body.username;
        const password = req.body.password;
        if (username.length < 1 || password.length < 1) 
            return res
                .status(400)
                .send({
                    statusCode: 400,
                    message: 'Vui lòng nhập đầy đủ thông tin.',
                    alert: 'Vui lòng nhập đầy đủ thông tin.',
                });
        const regex = /\w+/g;
        if (!regex.test(password))
            return res
                .status(400)
                .send({
                    statusCode: 400,
                    message: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.',
                    alert: 'Mật khẩu phải có ít nhất 8 ký tự, bao gồm chữ hoa, chữ thường và số.',
                });

        let user = await userModel.getUser(username);
        if(user.statusCode == 200){
            if(user.result.RefreshToken == 'NULL' || user.result.RefreshToken == null) {
                const hashPassword = await bcrypt.hashSync(process.env.DEFAULT_PASSWORD, SALT_ROUNDS);
                let refreshToken = await randToken.generate(24); 
                let SQLQueryInsert = `  UPDATE Users 
                                        SET Hashpassword = '${hashPassword}',RefreshToken = '${refreshToken}' 
                                        WHERE UserID = '${username}'`;
                await userModel.TruyVan("Admin", SQLQueryInsert);
                user = await userModel.getUser(username);
            }

            const isValid = await bcrypt.compareSync(password, user.result.HashPassword);
            if(!isValid)
                return res
                    .status(400)
                    .send({
                        statusCode: 400,
                        message: 'Tài khoản hoặc Mật khẩu không đúng.',
                        alert: "Tài khoản hoặc Mật khẩu không đúng",
                    });

            let refreshToken = await createToken(username, user.result.refreshToken);
            if(refreshToken.statusCode === 200) {
                return res.header({
                    'Keep-Alive': 'true',
                }).send({
                    accessToken: refreshToken.accessToken,
                    message: "Đăng nhập thành công",
                    username: user.message.username,
                    redirect: '/user/profile'
                });
            } else 
                return res
                    .status(400)
                    .send({
                        statusCode: 400,
                        message: 'Đăng nhập thất bại, vui lòng thử lại.', // Tạo access token không thành công
                        alert: 'Đăng nhập thất bại, vui lòng thử lại.',
                    });
        }
        else
            return res
                .status(400)
                .send({
                    statusCode: 400,
                    message: "Tài khoản không tồn tại", // 400: Username không hợp lệ
                    alert: "Tài khoản không tồn tại",
                });
    } catch (error) {
        console.log(error);
        return res
            .status(500)
            .send({
                statusCode: 500,
                message: 'Đăng nhập thất bại, vui lòng thử lại.', // 500: Lỗi server
            })
    }
}

async function refreshToken(req, res) {

    // Lấy access token từ header
	const accessTokenFromHeader = req.headers.x_authorization;
	if (!accessTokenFromHeader) 
		return res.status(400).send({ message: 'Không tìm thấy access token' });

	// Lấy refresh token từ body
	const refreshTokenFromBody = req.body.refreshToken;
	if (!refreshTokenFromBody) 
		return res.status(400).send({ message: 'Không tìm thấy refresh token' });

	const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET
	const accessTokenLife = process.env.ACCESS_TOKEN_LIFE

	// Decode access token đó
	const decoded = await authMethod.decodeToken(
		accessTokenFromHeader,
		accessTokenSecret,
	);
	if (!decoded) 
		return res.status(400).send({ message: 'Access token không hợp lệ' });

	const username = decoded.payload.username; // Lấy username từ payload

	const user = await userModel.getUser(username);
	if (!user) 
		return res.status(401).send({ message: 'Tài khoản không tồn tại' });

	if (refreshTokenFromBody !== user.message.refreshToken) 
		return res.status(400).send({ message: 'Refresh token không hợp lệ' });

	// Tạo access token mới
	const dataForAccessToken = {
		username,
	};

	const accessToken = await authMethod.generateToken(
		dataForAccessToken,
		accessTokenSecret,
		accessTokenLife,
	);
	if (!accessToken) 
		return res
			.status(400)
			.send({ message: 'Tạo access token không thành công, vui lòng thử lại.' });

	return res.json({
		accessToken,
	});
}

async function DoiMatKhau (req, res){
    try {
        console.log(`Thông tin ${JSON.stringify(req.user)}`)
        const password = req.body.password;
        const newPassword = req.body.newPassword;
        const confirmNewPassword = req.body.newPassword;
         
        let result_user = await userModel.getUser(req.body.username)
        const username = result_user.result.MaND;
        console.log(username);
        if ( !username || !password || !newPassword || !confirmNewPassword )
            return res 
                .status(400)
                .send({
                    statusCode: 400,
                    message: 'Vui lòng nhập đầy đủ thông tin.',
                    alert: 'Vui lòng nhập đầy đủ thông tin.',
                });
        const user = await userModel.getUser(username);
        if(user.statusCode == 200) {
            const isValid = bcrypt.compareSync(password, user.result.HashPassword);

            if(!isValid)
                return res
                    .status(400)
                    .send({
                        statusCode: 400,
                        message: 'Tài khoản hoặc Mật khẩu không đúng', 
                        alert: "Tài khoản hoặc Mật khẩu không đúng",
                    });
            if(newPassword !== confirmNewPassword)
                return res
                    .status(400)
                    .send({
                        statusCode: 400,
                        message: 'Mật khẩu mới không khớp', 
                        alert: "Mật khẩu mới không khớp",
                    });

            const hashPassword = bcrypt.hashSync(newPassword, 10);
            const updatePassword = await userModel.updatePassword(username, hashPassword);

            if(updatePassword.statusCode == 200)
                return res
                    .status(200)
                    .send({
                        statusCode: 200,
                        message: 'Đổi mật khẩu thành công', 
                        alert: "Đổi mật khẩu thành công",
                        redirect: '/user/profile'
                    });
            else
                return res
                    .status(400)
                    .send({
                        statusCode: 400,
                        message: 'Đổi mật khẩu thất bại', 
                        alert: "Đổi mật khẩu thất bại",
                    });
        }
    } catch (error) {
        console.log("Lỗi DoiMatKhau (auth.controllers): ", error);
        return res
            .status(500)
            .send({
                statusCode: 500,
                message: 'Lỗi server', 
                alert: "Lỗi server",
            });
    }
}

async function QuenMatKhau(req, res) {
    try {
        const username = req.body.username;
        if(!username) {
            return res
                .status(400)
                .send({
                    statusCode: 400,
                    message: 'Vui lòng nhập đầy đủ thông tin.',
                });
        }
        const user = await userModel.getUser(username);
        if(user.statusCode == 200){
            const newPassword = process.env.DEFAULT_PASSWORD;
            const hashPassword = bcrypt.hashSync(newPassword, 10);
            const updatePassword = await userModel.updatePassword(username, hashPassword);

            console.log(updatePassword)
            if(updatePassword.statusCode == 200)
                return res
                    .status(200)
                    .send({
                        statusCode: 200,
                        message: 'Đổi mật khẩu thành công', 
                        alert: "Đổi mật khẩu thành công",
                        redirect: '/user/profile'
                    });
            else
                return res
                    .status(400)
                    .send({
                        statusCode: 400,
                        message: 'Đổi mật khẩu thất bại', 
                        alert: "Đổi mật khẩu thất bại",
                    });
        } else 
            return res
                .status(400)
                .send({
                    statusCode: 400,
                    message: "Tài khoản không tồn tại"
                })
    } catch (error) {
    console.log("Lỗi DoiMatKhau (auth.controllers): ", error);
    return res
        .status(500)
        .send({
            statusCode: 500,
            message: 'Lỗi server', 
            alert: "Lỗi server",
        });
    }
}

exports.createToken = createToken;
exports.login = login;
exports.refreshToken = refreshToken;
exports.DoiMatKhau = DoiMatKhau;
exports.QuenMatKhau = QuenMatKhau;