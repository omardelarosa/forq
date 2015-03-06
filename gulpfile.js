var jshint = require('gulp-jshint');
var stylish = require('jshint-stylish');
var gulp = require('gulp');
var mocha = require('gulp-mocha');

gulp.task('lint', function(){
  return gulp.src([ './test/**/*.js', './index.js' ])
    .pipe(jshint())
    .pipe(jshint.reporter(stylish));
});

gulp.task('mocha', function () {
  return gulp.src('./test/**/*_spec.js', {read: false})
    .pipe(mocha({reporter: 'spec'}));
});

gulp.task('test', [ 'lint', 'mocha'] );

gulp.task('default', [ 'test' ]);

gulp.task('watch', function () {
  gulp.watch(['./test/**/*.js', './index.js'], [ 'test' ]);
});