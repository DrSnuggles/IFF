const gulp = require('gulp')
const rollup = require('gulp-better-rollup')
const terser = require('gulp-terser')
const rename = require('gulp-rename')
const brotli = require('gulp-brotli')

gulp.task('worklet', () => {
	return gulp.src('./js/audioWorklet.js')
		.pipe(terser())
		.pipe(gulp.dest('./dist'))
})

gulp.task('rollup', () => {
	return gulp.src('./js/iff.js')
		.pipe(rollup({ plugins: [] }, 'es'))
		.pipe(gulp.dest('./dist'))
})

gulp.task('minify', () => {
	return gulp.src('./dist/iff.js')
		.pipe(terser())
		.pipe(rename('./iff.min.js'))
		.pipe(gulp.dest('./dist'))
})

gulp.task('pack', () => {
	return gulp.src('./dist/iff.min.js')
		.pipe(brotli.compress())
		.pipe(gulp.dest('./dist'))
})

gulp.task('default', gulp.series('worklet','rollup','minify','pack'))