const gulp = require('gulp');
const cleanCSS = require('gulp-clean-css');
const sass = require('gulp-sass');
const watch = require('gulp-watch');
const babel = require("gulp-babel");
const htmlminify = require('gulp-htmlclean');
const pako = require('gulp-pako');
const brotli = require('gulp-brotli');
let input = {
	build: ['build/**/*', '!build/**/*.?(gz|gif|jpg|br|woff|woff2)'],
	js: ['src/assets/js/**/*.js', 'custom/src/assets/js/**/*.js', '!src/assets/js/**/*.min.js', '!custom/src/assets/js/**/*.min.js'],
	minjs: ['src/assets/js/**/*.min.js', 'custom/src/assets/js/**/*.min.js'],
	sass: ['src/assets/css/**/*.?(s)css', 'custom/src/assets/css/**/*.?(s)css'],
	staticFiles: ['src/static/**/*'],
	html: ['src/**/*.html']
};

let output = {
	js: 'build/assets/js',
	sass: 'build/assets/css',
	staticFiles: 'build/static',
	build: 'build'
};

gulp.task('staticFiles', (() => {
	return gulp.src(input.staticFiles)
		.pipe(gulp.dest(output.staticFiles))
}));

gulp.task('js', (() => {
	let presets = [];
	if (process.env.NODE_ENV === 'production') {
		presets.push('minify');
	}
	gulp.src(input.minjs)
		.pipe(gulp.dest(output.js));
	return gulp.src(input.js)
		.pipe(babel({
			presets
		}))
		.pipe(gulp.dest(output.js));
}));

gulp.task('html', (() => {
	return gulp.src(input.html)
		.pipe(htmlminify({
			unprotect: /<style[\s\S]+?<\/style>/
		}))
		.pipe(gulp.dest(output.build));
}));

gulp.task('sass', (() => {
	return gulp.src(input.sass)
		.pipe(sass().on('error', sass.logError))
		.pipe(cleanCSS({debug: 'development'}, details => {
			console.log(details.name + ': ' + details.stats.originalSize + ' -> ' + details.stats.minifiedSize);
		}))
		.pipe(gulp.dest(output.sass));
}));

gulp.task('gzip', () => {
  return gulp.src(input.build)
		.pipe(pako('gzip', {
			level: 9
		}))
		.pipe(gulp.dest(output.build));
});

gulp.task('brotli', () => {
  return gulp.src(input.build)
		.pipe(brotli.compress({
			skipLarger: true,
			quality: 11
		}))
		.pipe(gulp.dest(output.build));
});

gulp.task('watch', (() => {
	watch(input.js, gulp.series('js'));
	watch(input.sass, gulp.series('sass'));
	watch(input.html, gulp.series('html'));
	watch(input.staticFiles, gulp.series('staticFiles'));
}));

gulp.task('default', gulp.series(gulp.parallel('js', 'sass', 'html', 'staticFiles'), gulp.parallel('gzip', 'brotli')));
