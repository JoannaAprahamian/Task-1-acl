import Joi from 'joi';
import mongoose from 'mongoose';
import { Review } from '../models/Review.js';

const objectId = (value, helpers) =>
  mongoose.Types.ObjectId.isValid(value) ? value : helpers.error('any.invalid');

const createSchema = Joi.object({
  courseCode: Joi.string().min(2).max(20).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('').max(1000),
  reviewedBy: Joi.string().custom(objectId)
});

const updateSchema = Joi.object({
  courseCode: Joi.string().min(2).max(20),
  rating: Joi.number().integer().min(1).max(5),
  comment: Joi.string().allow('').max(1000),
  reviewedBy: Joi.string().custom(objectId)
});

function publicReview(r) {
  return {
    id: r._id.toString(),
    courseCode: r.courseCode,
    rating: r.rating,
    comment: r.comment,
    reviewedBy: r.reviewedBy,
    createdAt: r.createdAt
  };
}

// GET /api/reviews
// TODO: implement per README.md section 3.
export async function getAllReviews(req, res, next) {
  try {
    const reviews = await Review.find()
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'name email')
      .lean();
    res.json({ reviews: reviews.map(publicReview) });
  } catch (err) { next(err); }
}

// GET /api/reviews/:id
// TODO: implement per README.md sections 3 and 5.
export async function getReview(req, res, next) {
  try {
    const review = await Review.findById(req.params.id).populate('reviewedBy', 'name email');
    if (!review) return res.status(404).json({ message: 'Review not found' });
    res.json({ review: publicReview(review) });
  } catch (err) { next(err); }
}

// GET /api/reviews/summary?courseCode=CS101
// TODO: implement per README.md section 4.
export async function getCourseSummary(req, res, next) {
  try {
    const { courseCode } = req.query;
    if (!courseCode) return res.status(400).json({ message: 'courseCode query param is required' });

    const [result] = await Review.aggregate([
      { $match: { courseCode: courseCode.toUpperCase() } },
      { $group: { _id: '$courseCode', averageRating: { $avg: '$rating' }, reviewCount: { $sum: 1 } } }
    ]);

    if (!result) return res.json({ courseCode: courseCode.toUpperCase(), averageRating: null, reviewCount: 0 });

    res.json({
      courseCode: result._id,
      averageRating: Math.round(result.averageRating * 10) / 10,
      reviewCount: result.reviewCount
    });
  } catch (err) { next(err); }
}

// POST /api/reviews
// TODO: implement per README.md section 3.
export async function createReview(req, res, next) {
  try {
    const { value, error } = createSchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    const review = await Review.create(value);
    res.status(201).json({ review: publicReview(review) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'You already reviewed this course' });
    }
    next(err);
  }
}

// PATCH /api/reviews/:id
// TODO: implement per README.md sections 3 and 5.
export async function updateReview(req, res, next) {
  try {
    const { value, error } = updateSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const doc = await Review.findByIdAndUpdate(req.params.id, { $set: value }, { new: true, runValidators: true });
    if (!doc) return res.status(404).json({ message: 'Review not found' });
    res.json({ review: publicReview(doc) });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: 'Duplicate courseCode/reviewedBy pair' });
    }
    next(err);
  }
}

// DELETE /api/reviews/:id
// TODO: implement per README.md sections 3 and 5.
export async function deleteReview(req, res, next) {
  try {
    const doc = await Review.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Review not found' });
    res.json({ ok: true });
  } catch (err) { next(err); }
}